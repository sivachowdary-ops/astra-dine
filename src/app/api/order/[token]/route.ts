import { z } from "zod";
import { billFor } from "@/lib/rules";
import {
  OpError,
  addPayment,
  applyReward,
  db,
  ensureSession,
  joinMember,
  lineInput,
  openSessionFor,
  placeOrder,
  requestBill,
  sessionDetail,
  tableByToken,
} from "@/lib/server/ops";
import type { Category, Feedback, Member, MenuItem } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * The customer's phone, identified only by the table QR it scanned. It may see the menu and
 * this table's current visit, and add to it. Nothing else.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await tableByToken(token);
  if (!found) return Response.json({ error: "This table's QR code isn't active. Please ask the staff." }, { status: 404 });
  const { table, restaurant: r } = found;
  const [{ data: categories }, { data: items }, session] = await Promise.all([
    db().from("categories").select("*").eq("restaurant_id", r.id).order("sort"),
    db().from("menu_items").select("*").eq("restaurant_id", r.id).order("sort"),
    openSessionFor(table.id),
  ]);
  let visit = null;
  if (session) {
    const detail = await sessionDetail(session.id);
    const [{ data: member }, { data: calls }, { data: feedback }] = await Promise.all([
      session.member_id ? db().from("members").select("*").eq("id", session.member_id).maybeSingle<Member>() : Promise.resolve({ data: null }),
      db().from("calls").select("kind, at").eq("table_id", table.id).is("resolved_at", null),
      db().from("feedback").select("*").eq("session_id", session.id).maybeSingle<Feedback>(),
    ]);
    visit = {
      session: { id: session.id, status: session.status, bill_no: session.bill_no, discount_label: session.discount_label, stamped: session.stamped, opened_at: session.opened_at },
      orders: detail.orders.map((o) => ({ id: o.id, placed_at: o.placed_at, confirmed_at: o.confirmed_at })),
      lines: detail.lines.map(({ id, order_id, name, variant, addons, qty, unit_price, note, status }) => ({ id, order_id, name, variant, addons, qty, unit_price, note, status })),
      payments: detail.payments.map(({ mode, amount, status }) => ({ mode, amount, status })),
      bill: billFor(r, session, detail.lines, detail.payments),
      calls: calls ?? [],
      member: member ? { name: member.name, stamps: member.stamps, rewards_ready: member.rewards_ready, visits: member.visits, opt_in: member.opt_in } : null,
      feedback: feedback ? { route: feedback.route } : null,
    };
  }
  return Response.json(
    {
      restaurant: {
        name: r.name,
        place: r.place,
        upi_vpa: r.upi_vpa,
        upi_name: r.upi_name,
        pay_at_table: r.pay_at_table,
        confirm_first_order: r.confirm_first_order,
        stamps_for_reward: r.stamps_for_reward,
        stamp_min_bill: r.stamp_min_bill,
        reward_text: r.reward_text,
        google_review_url: r.google_review_url,
        gst_pct: r.gst_pct,
      },
      table: { label: table.label, area: table.area },
      categories: (categories ?? []) as Category[],
      items: ((items ?? []) as MenuItem[]).map(({ id, category_id, name, local_name, description, price, diet, spice, prep_minutes, tags, variants, addons, serves, image_url, available }) => ({
        id, category_id, name, local_name, description, price, diet, spice, prep_minutes, tags, variants, addons, serves, image_url, available,
      })),
      visit,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("order"), lines: z.array(lineInput).min(1).max(30) }),
  z.object({ type: z.literal("call"), kind: z.enum(["waiter", "water", "cutlery", "help"]) }),
  z.object({ type: z.literal("bill") }),
  z.object({ type: z.literal("join"), phone: z.string().regex(/^\+?[\d\s-]{10,16}$/), name: z.string().trim().max(40).nullish(), optIn: z.boolean() }),
  z.object({ type: z.literal("reward") }),
  z.object({ type: z.literal("upiPaid"), amount: z.number().int().min(1).max(500_000) }),
  z.object({ type: z.literal("gift"), code: z.string().trim().min(4).max(16) }),
  z.object({ type: z.literal("feedback"), food: z.number().int().min(1).max(5), service: z.number().int().min(1).max(5), comment: z.string().trim().max(400).nullish() }),
]);

// A small per-table guard against a phone hammering the server.
const recent = new Map<string, number[]>();
function tooFast(key: string) {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((t) => now - t < 60_000);
  hits.push(now);
  recent.set(key, hits);
  return hits.length > 40;
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await tableByToken(token);
  if (!found) return Response.json({ error: "This table's QR code isn't active. Please ask the staff." }, { status: 404 });
  if (tooFast(token)) return Response.json({ error: "Too many requests. Wait a moment." }, { status: 429 });
  const parsed = action.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "That didn't look right. Try again." }, { status: 400 });
  const { table, restaurant: r } = found;
  const a = parsed.data;
  try {
    if (a.type === "order") {
      const session = await ensureSession(r, table);
      const { needsStaff } = await placeOrder(r, session, a.lines, "qr");
      return Response.json({ ok: true, needsStaff });
    }
    if (a.type === "call") {
      const { count } = await db().from("calls").select("id", { count: "exact", head: true }).eq("table_id", table.id).eq("kind", a.kind).is("resolved_at", null);
      if (!count) await db().from("calls").insert({ restaurant_id: r.id, table_id: table.id, kind: a.kind });
      return Response.json({ ok: true });
    }
    const session = a.type === "join" ? await ensureSession(r, table) : await openSessionFor(table.id);
    if (!session) throw new OpError("Order something first.");
    if (a.type === "join") await joinMember(r, session, a.phone, a.name ?? null, a.optIn);
    if (a.type === "bill") await requestBill(r, session);
    if (a.type === "reward") await applyReward(r, session);
    if (a.type === "upiPaid") {
      if (!r.pay_at_table || !r.upi_vpa) throw new OpError("Please pay at the counter.");
      await addPayment(r, session, { mode: "upi", amount: a.amount, status: "claimed" });
    }
    if (a.type === "gift") await addPayment(r, session, { mode: "gift", status: "confirmed", giftCode: a.code });
    if (a.type === "feedback") {
      const happy = a.food >= 4 && a.service >= 4;
      const { data: m } = session.member_id ? await db().from("members").select("name").eq("id", session.member_id).maybeSingle<{ name: string | null }>() : { data: null };
      await db().from("feedback").insert({
        restaurant_id: r.id,
        session_id: session.id,
        table_label: table.label,
        guest_name: m?.name ?? null,
        food: a.food,
        service: a.service,
        comment: a.comment || null,
        route: happy ? "google-ask" : "manager",
      });
    }
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof OpError) return Response.json({ error: e.message }, { status: 409 });
    console.error("[order] failed:", (e as Error).message);
    return Response.json({ error: "Something went wrong. Please ask the staff." }, { status: 500 });
  }
}
