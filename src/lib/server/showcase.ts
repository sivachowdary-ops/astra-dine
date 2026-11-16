import "server-only";
import { billFor } from "../rules";
import type { DiningTable, Line, Order, Restaurant, Session } from "../types";
import { addPayment, confirmOrder, db, reviewPayment, sessionDetail, setLineStatus } from "./ops";

/**
 * The public "try it" tables at the showcase restaurant. Anyone can scan and order there, and a
 * simulated crew confirms, cooks, serves and takes payment so a visitor sees the whole loop on
 * their own phone. Nothing here touches any other table or any other restaurant.
 */

export const SHOWCASE_SLUG = "kaaram-kitchen";
export const TRY_AREA = "Try it";

const sec = (iso: string | null | undefined) => (iso ? (Date.now() - new Date(iso).getTime()) / 1000 : 0);

let cache: { at: number; r: Restaurant; tables: DiningTable[] } | null = null;
export async function showcase() {
  if (cache && Date.now() - cache.at < 60_000) return cache;
  const { data: r } = await db().from("restaurants").select("*").eq("slug", SHOWCASE_SLUG).maybeSingle<Restaurant>();
  if (!r) return null;
  const { data: tables } = await db().from("dining_tables").select("*").eq("restaurant_id", r.id).eq("area", TRY_AREA).order("sort");
  cache = { at: Date.now(), r, tables: (tables ?? []) as DiningTable[] };
  return cache;
}

export const isTryTable = (r: Pick<Restaurant, "slug">, t: Pick<DiningTable, "area">) => r.slug === SHOWCASE_SLUG && t.area === TRY_AREA;

let lastRun = 0;
let running: Promise<void> | null = null;
/** Moves every try-it order one step along when it has waited long enough. Cheap to call often. */
export async function advanceTryTables() {
  if (running) return running;
  if (Date.now() - lastRun < 2500) return;
  lastRun = Date.now();
  running = advance().finally(() => (running = null));
  return running;
}

async function advance() {
  const s = await showcase();
  if (!s?.tables.length) return;
  const { r, tables } = s;
  const ids = tables.map((t) => t.id);
  const { data: open } = await db().from("table_sessions").select("*").in("table_id", ids).neq("status", "closed");
  const now = new Date().toISOString();
  for (const session of (open ?? []) as Session[]) {
    // A visitor who walked away: clear the table for the next one.
    if (sec(session.opened_at) > 40 * 60 || (session.status === "paid" && sec(session.paid_at) > 8 * 60)) {
      await db().from("table_sessions").update({ status: "closed", closed_at: now }).eq("id", session.id);
      await db().from("calls").update({ resolved_at: now }).eq("table_id", session.table_id).is("resolved_at", null);
      continue;
    }
    const { orders, lines, payments } = await sessionDetail(session.id);
    for (const o of orders as Order[]) if (!o.confirmed_at && sec(o.placed_at) > 6) await confirmOrder(o.id, r.id, null, true);
    const step = (from: Line["status"], after: (l: Line) => boolean) => lines.filter((l) => l.status === from && after(l)).map((l) => l.id);
    const cook = step("queued", (l) => sec(l.fired_at) > 10);
    const ready = step("cooking", (l) => sec(l.fired_at) > 40);
    const served = step("ready", (l) => sec(l.ready_at) > 15);
    if (cook.length) await setLineStatus(r.id, cook, "cooking");
    if (ready.length) await setLineStatus(r.id, ready, "ready");
    if (served.length) await setLineStatus(r.id, served, "served");
    for (const p of payments) if (p.status === "claimed" && sec(p.at) > 8) await reviewPayment(r, p.id, true, null);
    if (session.status === "bill" && sec(session.bill_requested_at) > 12) {
      const bill = billFor(r, session, lines, payments);
      if (bill.due > 0 && !bill.claimed) await addPayment(r, session, { mode: "cash", status: "confirmed" }).catch(() => {});
    }
  }
  await db().from("calls").update({ resolved_at: now }).in("table_id", ids).is("resolved_at", null).lt("at", new Date(Date.now() - 15_000).toISOString());
  // Visitors may type their own number to try the stamp card. Showcase numbers start with 5;
  // any other number is removed within the hour.
  const { data: real } = await db()
    .from("members")
    .select("id")
    .eq("restaurant_id", r.id)
    .not("phone", "like", "+915%")
    .lt("joined_at", new Date(Date.now() - 45 * 60_000).toISOString());
  const gone = ((real ?? []) as { id: string }[]).map((m) => m.id);
  if (gone.length) {
    await db().from("table_sessions").update({ member_id: null }).in("member_id", gone);
    await db().from("members").delete().in("id", gone);
  }
}

/** A free try-it table for the next visitor (or the one that has been sitting longest). */
export async function pickTryTable() {
  const s = await showcase();
  if (!s?.tables.length) return null;
  const { data: open } = await db().from("table_sessions").select("id, table_id, opened_at").in("table_id", s.tables.map((t) => t.id)).neq("status", "closed").order("opened_at");
  const busy = new Set(((open ?? []) as { table_id: string }[]).map((x) => x.table_id));
  const free = s.tables.filter((t) => !busy.has(t.id));
  if (free.length) return free[Math.floor(Math.random() * free.length)]!;
  const oldest = (open ?? [])[0] as { id: string; table_id: string } | undefined;
  if (!oldest) return s.tables[0]!;
  await db().from("table_sessions").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", oldest.id);
  return s.tables.find((t) => t.id === oldest.table_id)!;
}

/** What the sales page shows live: try-it tables and their dishes. No names, no numbers. */
export async function tryLive() {
  const s = await showcase();
  if (!s) return null;
  const ids = s.tables.map((t) => t.id);
  const since = new Date(Date.now() - 20 * 60_000).toISOString();
  const { data: sessions } = await db().from("table_sessions").select("*").in("table_id", ids).or(`status.neq.closed,closed_at.gte.${since}`).order("opened_at", { ascending: false }).limit(12);
  const list = (sessions ?? []) as Session[];
  const sids = list.map((x) => x.id);
  const [{ data: lines }, { data: orders }, { data: payments }] = await Promise.all([
    sids.length ? db().from("order_lines").select("*").in("session_id", sids).order("created_at") : Promise.resolve({ data: [] }),
    sids.length ? db().from("orders").select("*").in("session_id", sids).order("placed_at") : Promise.resolve({ data: [] }),
    sids.length ? db().from("payments").select("*").in("session_id", sids) : Promise.resolve({ data: [] }),
  ]);
  const L = (lines ?? []) as Line[];
  const O = (orders ?? []) as Order[];
  return {
    restaurant: s.r.name,
    tables: s.tables.map((t) => {
      const v = list.find((x) => x.table_id === t.id && x.status !== "closed");
      const ls = v ? L.filter((l) => l.session_id === v.id) : [];
      const bill = v ? billFor(s.r, v, ls, ((payments ?? []) as never[]).filter((p: { session_id: string }) => p.session_id === v.id)) : null;
      return {
        label: t.label,
        status: v ? v.status : "free",
        since: v?.opened_at ?? null,
        total: bill?.total ?? 0,
        tickets: v
          ? O.filter((o) => o.session_id === v.id).map((o) => ({
              kot: o.kot,
              at: o.placed_at,
              confirmed: Boolean(o.confirmed_at),
              lines: ls.filter((l) => l.order_id === o.id).map((l) => ({ name: l.name, qty: l.qty, note: l.note, status: l.status })),
            }))
          : [],
      };
    }),
  };
}
export type TryLive = NonNullable<Awaited<ReturnType<typeof tryLive>>>;
