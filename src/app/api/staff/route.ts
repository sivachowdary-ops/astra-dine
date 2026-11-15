import { z } from "zod";
import { currentStaff } from "@/lib/auth";
import {
  OpError,
  addPayment,
  applyReward,
  confirmOrder,
  db,
  ensureSession,
  joinMember,
  lineInput,
  placeOrder,
  requestBill,
  reviewPayment,
  setLineStatus,
} from "@/lib/server/ops";
import type { DiningTable, Role, Session } from "@/lib/types";

export const dynamic = "force-dynamic";

const uuid = z.string().uuid();
const action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("confirmOrder"), orderId: uuid, accept: z.boolean() }),
  z.object({ type: z.literal("lines"), lineIds: z.array(uuid).min(1).max(60), status: z.enum(["cooking", "ready", "served", "queued", "cancelled"]) }),
  z.object({ type: z.literal("resolveCall"), callId: uuid }),
  z.object({ type: z.literal("seat"), tableId: uuid, guests: z.number().int().min(1).max(30) }),
  z.object({ type: z.literal("staffOrder"), tableId: uuid, lines: z.array(lineInput).min(1).max(40) }),
  z.object({ type: z.literal("requestBill"), sessionId: uuid }),
  z.object({ type: z.literal("applyReward"), sessionId: uuid }),
  z.object({ type: z.literal("pay"), sessionId: uuid, mode: z.enum(["upi", "cash", "card", "gift"]), amount: z.number().int().min(1).max(500_000).optional(), giftCode: z.string().max(16).optional() }),
  z.object({ type: z.literal("reviewPayment"), paymentId: uuid, ok: z.boolean() }),
  z.object({ type: z.literal("close"), sessionId: uuid }),
  z.object({ type: z.literal("available"), itemId: uuid, available: z.boolean() }),
  z.object({ type: z.literal("member"), sessionId: uuid, phone: z.string().regex(/^\+?[\d\s-]{10,16}$/), name: z.string().trim().max(40).nullish() }),
  z.object({ type: z.literal("issueGift"), value: z.number().int().min(100).max(50_000), from: z.string().trim().max(40), to: z.string().trim().min(1).max(40) }),
]);
type Action = z.infer<typeof action>;

/** Who may do what. Owners may do everything. */
const allowed: Record<Action["type"], Role[]> = {
  confirmOrder: ["cashier", "manager"],
  lines: ["kitchen", "cashier", "manager"],
  resolveCall: ["cashier", "manager"],
  seat: ["cashier", "manager"],
  staffOrder: ["cashier", "manager"],
  requestBill: ["cashier", "manager"],
  applyReward: ["cashier", "manager"],
  pay: ["cashier", "manager"],
  reviewPayment: ["cashier", "manager"],
  close: ["cashier", "manager"],
  available: ["kitchen", "cashier", "manager"],
  member: ["cashier", "manager"],
  issueGift: ["cashier", "manager"],
};

export async function POST(req: Request) {
  const parsed = action.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "That action isn't valid." }, { status: 400 });
  const a = parsed.data;
  const me = await currentStaff(allowed[a.type]);
  if (!me) return Response.json({ error: "Sign in again: this account can't do that." }, { status: 401 });
  const { restaurant: r, staff } = me;
  const session = async (id: string) => {
    const { data } = await db().from("table_sessions").select("*").eq("id", id).eq("restaurant_id", r.id).maybeSingle<Session>();
    if (!data) throw new OpError("Table not found.");
    return data;
  };
  const table = async (id: string) => {
    const { data } = await db().from("dining_tables").select("*").eq("id", id).eq("restaurant_id", r.id).maybeSingle<DiningTable>();
    if (!data) throw new OpError("Table not found.");
    return data;
  };
  try {
    switch (a.type) {
      case "confirmOrder":
        await confirmOrder(a.orderId, r.id, staff.user_id, a.accept);
        break;
      case "lines":
        if (staff.role === "kitchen" && !["cooking", "ready", "queued"].includes(a.status)) throw new OpError("The kitchen can't do that.");
        await setLineStatus(r.id, a.lineIds, a.status);
        break;
      case "resolveCall":
        await db().from("calls").update({ resolved_at: new Date().toISOString() }).eq("id", a.callId).eq("restaurant_id", r.id);
        break;
      case "seat":
        await ensureSession(r, await table(a.tableId), a.guests);
        break;
      case "staffOrder": {
        const s = await ensureSession(r, await table(a.tableId));
        await placeOrder(r, s, a.lines, "staff", staff.user_id);
        break;
      }
      case "requestBill":
        await requestBill(r, await session(a.sessionId));
        break;
      case "applyReward":
        await applyReward(r, await session(a.sessionId));
        break;
      case "pay":
        await addPayment(r, await session(a.sessionId), { mode: a.mode, amount: a.amount, status: "confirmed", by: staff.user_id, giftCode: a.giftCode });
        break;
      case "reviewPayment":
        await reviewPayment(r, a.paymentId, a.ok, staff.user_id);
        break;
      case "close": {
        const s = await session(a.sessionId);
        if (s.status !== "paid") throw new OpError("This table still has an unpaid bill.");
        const now = new Date().toISOString();
        await db().from("table_sessions").update({ status: "closed", closed_at: now }).eq("id", s.id);
        await db().from("calls").update({ resolved_at: now }).eq("table_id", s.table_id).is("resolved_at", null);
        break;
      }
      case "available":
        await db().from("menu_items").update({ available: a.available }).eq("id", a.itemId).eq("restaurant_id", r.id);
        break;
      case "member":
        await joinMember(r, await session(a.sessionId), a.phone, a.name ?? null, false);
        break;
      case "issueGift": {
        const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
        const code = `${r.slug.slice(0, 2).toUpperCase()}-${Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")}`;
        await db().from("gift_cards").insert({ restaurant_id: r.id, code, value: a.value, balance: a.value, from_name: a.from || null, to_name: a.to });
        return Response.json({ ok: true, code });
      }
    }
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof OpError) return Response.json({ error: e.message }, { status: 409 });
    console.error("[staff] failed:", (e as Error).message);
    return Response.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
