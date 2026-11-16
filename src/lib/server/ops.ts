import "server-only";
import { z } from "zod";
import { billFor, servingNow, unitPrice } from "../rules";
import { adminClient } from "../supabase/server";
import type { Category, DiningTable, Line, LineStatus, Member, MenuItem, Order, Payment, Restaurant, Session } from "../types";

/**
 * Everything that changes a restaurant's day, run on the server after the caller has been
 * checked. Prices always come from the menu in the database, never from the phone.
 */

export const db = () => adminClient();

export class OpError extends Error {}

export const lineInput = z.object({
  itemId: z.string().uuid(),
  variantId: z.string().max(20).nullish(),
  addonIds: z.array(z.string().max(20)).max(8).default([]),
  qty: z.number().int().min(1).max(20),
  note: z.string().max(120).nullish(),
});
export type LineInput = z.infer<typeof lineInput>;

export async function tableByToken(token: string) {
  if (!/^[a-f0-9]{12,40}$/.test(token)) return null;
  const { data: table } = await db().from("dining_tables").select("*").eq("qr_token", token).maybeSingle<DiningTable>();
  if (!table) return null;
  const { data: restaurant } = await db().from("restaurants").select("*").eq("id", table.restaurant_id).single<Restaurant>();
  return restaurant ? { table, restaurant } : null;
}

export async function openSessionFor(tableId: string) {
  const { data } = await db().from("table_sessions").select("*").eq("table_id", tableId).neq("status", "closed").maybeSingle<Session>();
  return data ?? null;
}

export async function ensureSession(r: Restaurant, table: DiningTable, guests = 2): Promise<Session> {
  const existing = await openSessionFor(table.id);
  if (existing) return existing;
  const { data, error } = await db().from("table_sessions").insert({ restaurant_id: r.id, table_id: table.id, guests }).select("*").single<Session>();
  if (error) {
    // Two phones at the same table opened it at the same moment.
    const again = await openSessionFor(table.id);
    if (again) return again;
    throw new OpError("Couldn't open the table. Try again.");
  }
  return data;
}

export async function sessionDetail(sessionId: string) {
  const [{ data: orders }, { data: lines }, { data: payments }] = await Promise.all([
    db().from("orders").select("*").eq("session_id", sessionId).order("placed_at"),
    db().from("order_lines").select("*").eq("session_id", sessionId).order("created_at"),
    db().from("payments").select("*").eq("session_id", sessionId).order("at"),
  ]);
  return { orders: (orders ?? []) as Order[], lines: (lines ?? []) as Line[], payments: (payments ?? []) as Payment[] };
}

export async function placeOrder(r: Restaurant, session: Session, input: LineInput[], source: "qr" | "staff", by?: string) {
  if (session.status !== "seated") throw new OpError("The bill has been asked for. Ask staff to add to it.");
  const ids = [...new Set(input.map((l) => l.itemId))];
  const { data: items } = await db().from("menu_items").select("*").eq("restaurant_id", r.id).in("id", ids);
  const byId = new Map(((items ?? []) as MenuItem[]).map((i) => [i.id, i]));
  const { data: cats } = await db().from("categories").select("id, available_from, available_to").eq("restaurant_id", r.id);
  const closed = new Set(((cats ?? []) as Pick<Category, "id" | "available_from" | "available_to">[]).filter((c) => !servingNow(c)).map((c) => c.id));
  const { count } = await db().from("orders").select("id", { count: "exact", head: true }).eq("session_id", session.id).not("confirmed_at", "is", null);
  const needsStaff = source === "qr" && r.confirm_first_order && !count;
  const status: LineStatus = needsStaff ? "pending" : "queued";
  const now = new Date().toISOString();
  const lines = input.flatMap((l) => {
    const item = byId.get(l.itemId);
    if (!item || !item.available || closed.has(item.category_id)) return [];
    const variant = item.variants.find((v) => v.id === l.variantId);
    const addons = item.addons.filter((a) => l.addonIds.includes(a.id));
    return [
      {
        restaurant_id: r.id,
        session_id: session.id,
        item_id: item.id,
        name: item.name,
        variant: variant?.label ?? null,
        addons: addons.map((a) => a.label),
        qty: l.qty,
        unit_price: unitPrice(item, variant?.id, addons.map((a) => a.id)),
        note: l.note?.trim() || null,
        station: item.station,
        status,
        fired_at: needsStaff ? null : now,
      },
    ];
  });
  if (!lines.length) throw new OpError("Those dishes aren't available right now.");
  const { data: kot } = await db().rpc("next_number", { r: r.id, kind: "kot" });
  const { data: order, error } = await db()
    .from("orders")
    .insert({ restaurant_id: r.id, session_id: session.id, kot, source, confirmed_at: needsStaff ? null : now, confirmed_by: needsStaff ? null : (by ?? null) })
    .select("*")
    .single<Order>();
  if (error || !order) throw new OpError("Couldn't send the order. Try again.");
  await db().from("order_lines").insert(lines.map((l) => ({ ...l, order_id: order.id })));
  if (source === "qr" && !session.via_qr) await db().from("table_sessions").update({ via_qr: true }).eq("id", session.id);
  return { order, needsStaff };
}

export async function confirmOrder(orderId: string, restaurantId: string, by: string | null, accept: boolean) {
  const now = new Date().toISOString();
  const { data: order } = await db().from("orders").select("*").eq("id", orderId).eq("restaurant_id", restaurantId).maybeSingle<Order>();
  if (!order) throw new OpError("Order not found.");
  if (accept) {
    await db().from("orders").update({ confirmed_at: now, confirmed_by: by }).eq("id", orderId);
    await db().from("order_lines").update({ status: "queued", fired_at: now }).eq("order_id", orderId).eq("status", "pending");
  } else {
    await db().from("order_lines").update({ status: "cancelled" }).eq("order_id", orderId).eq("status", "pending");
  }
}

export async function setLineStatus(restaurantId: string, lineIds: string[], status: LineStatus) {
  const now = new Date().toISOString();
  const patch: Partial<Line> = { status };
  if (status === "queued") patch.fired_at = now;
  if (status === "ready") patch.ready_at = now;
  if (status === "served") patch.served_at = now;
  await db().from("order_lines").update(patch).eq("restaurant_id", restaurantId).in("id", lineIds);
}

export async function requestBill(r: Restaurant, session: Session) {
  if (session.status !== "seated") return;
  const { data: billNo } = await db().rpc("next_number", { r: r.id, kind: "bill" });
  await db().from("table_sessions").update({ status: "bill", bill_requested_at: new Date().toISOString(), bill_no: billNo }).eq("id", session.id);
  const { count } = await db().from("calls").select("id", { count: "exact", head: true }).eq("table_id", session.table_id).eq("kind", "bill").is("resolved_at", null);
  if (!count) await db().from("calls").insert({ restaurant_id: r.id, table_id: session.table_id, kind: "bill" });
}

export async function applyReward(r: Restaurant, session: Session) {
  if (!session.member_id) throw new OpError("Add the guest's number first.");
  if (session.discount) throw new OpError("A reward is already on this bill.");
  const { data: m } = await db().from("members").select("*").eq("id", session.member_id).single<Member>();
  if (!m || m.rewards_ready < 1) throw new OpError("No reward is ready for this guest.");
  await db().from("members").update({ rewards_ready: m.rewards_ready - 1 }).eq("id", m.id);
  await db().from("table_sessions").update({ discount: r.reward_value, discount_label: r.reward_text }).eq("id", session.id);
}

export async function addPayment(r: Restaurant, session: Session, p: { mode: Payment["mode"]; amount?: number; status: Payment["status"]; ref?: string; by?: string; giftCode?: string }) {
  if (session.status === "paid" || session.status === "closed") throw new OpError("This bill is already paid.");
  const detail = await sessionDetail(session.id);
  const bill = billFor(r, session, detail.lines, detail.payments);
  let amount = Math.min(bill.due, p.amount ?? bill.due);
  if (p.mode === "gift") {
    const { data: card } = await db().from("gift_cards").select("*").eq("restaurant_id", r.id).ilike("code", (p.giftCode ?? "").trim()).maybeSingle<{ id: string; balance: number }>();
    if (!card) throw new OpError("That gift card code isn't valid here.");
    if (card.balance < 1) throw new OpError("That gift card has no balance left.");
    amount = Math.min(amount, card.balance);
    await db().from("gift_cards").update({ balance: card.balance - amount }).eq("id", card.id);
  }
  if (amount < 1) throw new OpError("Nothing left to pay on this bill.");
  if (session.status === "seated") await requestBill(r, session);
  await db().from("payments").insert({
    restaurant_id: r.id,
    session_id: session.id,
    mode: p.mode,
    amount,
    status: p.status,
    ref: p.ref ?? null,
    confirmed_by: p.status === "confirmed" ? (p.by ?? null) : null,
  });
  await settleIfPaid(r, session.id);
}

export async function reviewPayment(r: Restaurant, paymentId: string, ok: boolean, by: string | null) {
  const { data: pay } = await db().from("payments").select("*").eq("id", paymentId).eq("restaurant_id", r.id).maybeSingle<Payment>();
  if (!pay) throw new OpError("Payment not found.");
  await db().from("payments").update({ status: ok ? "confirmed" : "rejected", confirmed_by: by }).eq("id", paymentId);
  await settleIfPaid(r, pay.session_id);
}

/** Closes the bill once confirmed payments cover it: stamps, member totals, report figures. */
export async function settleIfPaid(r: Restaurant, sessionId: string) {
  const { data: s } = await db().from("table_sessions").select("*").eq("id", sessionId).single<Session>();
  if (!s || s.status === "paid" || s.status === "closed") return;
  const detail = await sessionDetail(sessionId);
  const bill = billFor(r, s, detail.lines, detail.payments);
  if (bill.total <= 0 || bill.paid < bill.total) return;
  const now = new Date().toISOString();
  let stamped = false;
  if (s.member_id) {
    const { data: m } = await db().from("members").select("*").eq("id", s.member_id).single<Member>();
    if (m) {
      let stamps = m.stamps;
      let rewards = m.rewards_ready;
      if (bill.total >= r.stamp_min_bill) {
        stamped = true;
        stamps += 1;
        if (stamps >= r.stamps_for_reward) {
          stamps = 0;
          rewards += 1;
        }
      }
      await db().from("members").update({ visits: m.visits + 1, spend: m.spend + bill.total, stamps, rewards_ready: rewards, last_visit: now }).eq("id", m.id);
    }
  }
  await db().from("table_sessions").update({ status: "paid", paid_at: now, subtotal: bill.subtotal, total: bill.total, stamped }).eq("id", sessionId);
  await db().from("calls").update({ resolved_at: now }).eq("table_id", s.table_id).eq("kind", "bill").is("resolved_at", null);
}

export async function joinMember(r: Restaurant, session: Session, phone: string, name: string | null, optIn: boolean) {
  const clean = phone.replace(/[^\d+]/g, "");
  const { data: existing } = await db().from("members").select("*").eq("restaurant_id", r.id).eq("phone", clean).maybeSingle<Member>();
  let member = existing;
  if (!member) {
    const { data } = await db().from("members").insert({ restaurant_id: r.id, phone: clean, name, opt_in: optIn }).select("*").single<Member>();
    member = data;
  } else if ((name && !member.name) || (optIn && !member.opt_in)) {
    await db().from("members").update({ name: member.name ?? name, opt_in: member.opt_in || optIn }).eq("id", member.id);
  }
  if (!member) throw new OpError("Couldn't save your number. Try again.");
  await db().from("table_sessions").update({ member_id: member.id }).eq("id", session.id);
  return member;
}
