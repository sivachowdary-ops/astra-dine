import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { servingNow, staffEmail } from "../rules";
import { adminClient, userClient } from "../supabase/server";
import type { Category, DiningTable, Line, MenuItem, Order, Restaurant, Session } from "../types";
import { addPayment, confirmOrder, ensureSession, placeOrder, requestBill, sessionDetail, setLineStatus } from "./ops";
import { SHOWCASE_SLUG } from "./showcase";

/**
 * "Try the whole restaurant yourself": a private 24-hour copy of Kaaram Kitchen for one visitor.
 * Their laptop opens as the owner; QR codes sign other devices in as the kitchen or the cashier
 * (single use, 2 hours). Pretend guests keep ordering so every screen has something to do, and
 * whatever the visitor doesn't handle moves along on its own after a few minutes.
 */

const HOURS = 24;
const MAX_ACTIVE = 25;
const DAYS = 21;
const db = () => adminClient();
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const MIN = 60_000;

export class TrialError extends Error {}
export const isTrial = (r: Pick<Restaurant, "expires_at">) => Boolean(r.expires_at);

export async function cleanupTrials() {
  const { data: old } = await db().from("restaurants").select("id").not("expires_at", "is", null).lt("expires_at", new Date().toISOString());
  for (const r of old ?? []) {
    const { data: staff } = await db().from("staff").select("user_id").eq("restaurant_id", r.id);
    await db().from("restaurants").delete().eq("id", r.id);
    for (const s of staff ?? []) await db().auth.admin.deleteUser(s.user_id).catch(() => {});
  }
  return old?.length ?? 0;
}

export async function createTrial() {
  await cleanupTrials();
  const { count } = await db().from("restaurants").select("id", { count: "exact", head: true }).not("expires_at", "is", null);
  if ((count ?? 0) >= MAX_ACTIVE) throw new TrialError("Lots of people are trying it right now. Please try again in an hour, or message us for a demo.");
  const { data: src } = await db().from("restaurants").select("id, name").eq("slug", SHOWCASE_SLUG).single();
  if (!src) throw new TrialError("The sample restaurant isn't set up yet.");
  const slug = `try-${randomBytes(4).toString("hex")}`;
  const { data: r, error } = await db()
    .from("restaurants")
    .insert({ slug, name: src.name, expires_at: new Date(Date.now() + HOURS * 3_600_000).toISOString() })
    .select("id")
    .single();
  if (error || !r) throw new Error(error?.message ?? "restaurant");
  try {
    const people = [
      { username: "owner", name: "You, the owner", role: "owner" },
      { username: "kitchen", name: "Kitchen screen", role: "kitchen" },
      { username: "cashier", name: "Front counter", role: "cashier" },
    ];
    const ids: Record<string, string> = {};
    for (const p of people) {
      const { data, error: e } = await db().auth.admin.createUser({ email: staffEmail(slug, p.username), password: randomBytes(24).toString("base64url"), email_confirm: true, user_metadata: { name: p.name, trial: true } });
      if (e || !data.user) throw new Error(e?.message ?? "user");
      ids[p.role] = data.user.id;
      await db().from("staff").insert({ user_id: data.user.id, restaurant_id: r.id, name: p.name, username: p.username, role: p.role });
    }
    const { error: ce } = await db().rpc("clone_restaurant", { src: src.id, dst: r.id, days: DAYS });
    if (ce) throw new Error(ce.message);
    return { restaurantId: r.id, slug, ownerId: ids.owner! };
  } catch (e) {
    const { data: staff } = await db().from("staff").select("user_id").eq("restaurant_id", r.id);
    await db().from("restaurants").delete().eq("id", r.id);
    for (const s of staff ?? []) await db().auth.admin.deleteUser(s.user_id).catch(() => {});
    throw e;
  }
}

/** Signs this browser in as the given person with a one-time link (no password involved). */
export async function signInAs(userId: string) {
  const { data: u } = await db().auth.admin.getUserById(userId);
  const email = u.user?.email;
  if (!email) throw new TrialError("That login no longer exists.");
  const { data: link, error } = await db().auth.admin.generateLink({ type: "magiclink", email });
  if (error || !link.properties?.hashed_token) throw new Error(error?.message ?? "link");
  const supabase = await userClient();
  const { error: ve } = await supabase.auth.verifyOtp({ type: "email", token_hash: link.properties.hashed_token });
  if (ve) throw new Error(ve.message);
}

/** A single-use link that signs another device in as this copy's kitchen or cashier. */
export async function deviceLink(restaurantId: string, role: "kitchen" | "cashier") {
  const { data: r } = await db().from("restaurants").select("expires_at").eq("id", restaurantId).single();
  if (!r?.expires_at) throw new TrialError("This isn't a trial copy.");
  const { data: s } = await db().from("staff").select("user_id").eq("restaurant_id", restaurantId).eq("role", role).single();
  if (!s) throw new TrialError("That screen's login is missing.");
  const token = randomBytes(24).toString("base64url");
  await db().from("trial_tokens").insert({ token_hash: sha(token), user_id: s.user_id, path: role === "kitchen" ? "/kitchen" : "/pos", expires_at: new Date(Date.now() + 2 * 3_600_000).toISOString() });
  return token;
}

export async function redeem(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const now = new Date().toISOString();
  const { data } = await db().from("trial_tokens").update({ used_at: now }).eq("token_hash", sha(token)).is("used_at", null).gt("expires_at", now).select("user_id, path").maybeSingle();
  return data ? { userId: data.user_id as string, path: data.path as string } : null;
}

/* ---------- Keeping a copy busy ---------- */

const last: Record<string, number> = {};
const sec = (iso: string | null | undefined) => (iso ? (Date.now() - new Date(iso).getTime()) / 1000 : 0);
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;

/** Pretend guests order now and then; anything left alone moves on after a few minutes. */
export async function pumpTrial(r: Restaurant) {
  if (!r.expires_at) return;
  if (Date.now() - (last[r.id] ?? 0) < 20_000) return;
  last[r.id] = Date.now();
  try {
    const [{ data: tables }, { data: open }, { data: cats }, { data: items }] = await Promise.all([
      db().from("dining_tables").select("*").eq("restaurant_id", r.id),
      db().from("table_sessions").select("*").eq("restaurant_id", r.id).neq("status", "closed"),
      db().from("categories").select("id, available_from, available_to").eq("restaurant_id", r.id),
      db().from("menu_items").select("id, category_id, available, price, station").eq("restaurant_id", r.id),
    ]);
    const sessions = (open ?? []) as Session[];
    // A new table every few minutes, up to five busy tables at once.
    const newest = sessions.reduce((m, s) => Math.max(m, new Date(s.opened_at).getTime()), 0);
    if (sessions.length < 5 && Date.now() - newest > 3 * MIN) {
      const busy = new Set(sessions.map((s) => s.table_id));
      const free = ((tables ?? []) as DiningTable[]).filter((t) => !busy.has(t.id));
      const serving = new Set(((cats ?? []) as Pick<Category, "id" | "available_from" | "available_to">[]).filter((c) => servingNow(c)).map((c) => c.id));
      const menu = ((items ?? []) as Pick<MenuItem, "id" | "category_id" | "available">[]).filter((i) => i.available && serving.has(i.category_id));
      if (free.length && menu.length >= 3) {
        const table = pick(free);
        const session = await ensureSession(r, table, 2 + Math.floor(Math.random() * 3));
        const lines = Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => ({ itemId: pick(menu).id, addonIds: [], qty: 1 + (Math.random() < 0.25 ? 1 : 0) }));
        await placeOrder(r, session, lines, "qr");
        if (Math.random() < 0.4) await db().from("calls").insert({ restaurant_id: r.id, table_id: table.id, kind: pick(["water", "waiter", "cutlery"]) });
      }
    }
    // Whatever the visitor doesn't handle, the place handles slowly on its own.
    for (const s of sessions) {
      if (s.status === "paid") {
        if (sec(s.paid_at) > 3 * 60) await db().from("table_sessions").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", s.id);
        continue;
      }
      const { orders, lines, payments } = await sessionDetail(s.id);
      for (const o of orders as Order[]) if (!o.confirmed_at && sec(o.placed_at) > 4 * 60) await confirmOrder(o.id, r.id, null, true);
      const ids = (from: Line["status"], ok: (l: Line) => boolean) => lines.filter((l) => l.status === from && ok(l)).map((l) => l.id);
      const cook = ids("queued", (l) => sec(l.fired_at) > 5 * 60);
      const ready = ids("cooking", (l) => sec(l.fired_at) > 9 * 60);
      const served = ids("ready", (l) => sec(l.ready_at) > 3 * 60);
      if (cook.length) await setLineStatus(r.id, cook, "cooking");
      if (ready.length) await setLineStatus(r.id, ready, "ready");
      if (served.length) await setLineStatus(r.id, served, "served");
      const allServed = lines.length > 0 && lines.every((l) => l.status === "served" || l.status === "cancelled");
      if (s.status === "seated" && allServed && sec(s.opened_at) > 20 * 60) await requestBill(r, s);
      if (s.status === "bill" && sec(s.bill_requested_at) > 5 * 60 && !payments.some((p) => p.status === "claimed")) await addPayment(r, s, { mode: pick(["upi", "cash", "card"]) as "upi" | "cash" | "card", status: "confirmed" }).catch(() => {});
    }
    await db().from("calls").update({ resolved_at: new Date().toISOString() }).eq("restaurant_id", r.id).is("resolved_at", null).lt("at", new Date(Date.now() - 4 * MIN).toISOString());
  } catch (e) {
    console.error("[trial] step failed:", (e as Error).message);
  }
}
