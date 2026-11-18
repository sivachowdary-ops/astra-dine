"use client";

import { useMemo, useState } from "react";
import { BellRing, Check, Gift, Minus, Plus, Printer, Search, Volume2, VolumeX, X } from "lucide-react";
import { useNewItems, useSound, useTitleCount } from "@/lib/chime";
import { call, useLive, useNow } from "@/lib/live";
import { ago, billFor, inr, minsSince } from "@/lib/rules";
import { browserClient } from "@/lib/supabase/browser";
import type { Call, DiningTable, Line, Member, MenuItem, Order, Payment, Restaurant, Session, Staff } from "@/lib/types";
import { DietMark, Sheet } from "../bits";
import { SignOut } from "../staff-login";

type Data = {
  tables: DiningTable[];
  sessions: Session[];
  orders: Order[];
  lines: Line[];
  payments: Payment[];
  calls: Call[];
  members: Member[];
  items: MenuItem[];
  today: { total: number | null; payments: Payment[] }[];
};

async function load(rid: string): Promise<Data> {
  const db = browserClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [tables, sessions, calls, items, paidToday] = await Promise.all([
    db.from("dining_tables").select("*").eq("restaurant_id", rid).order("sort"),
    db.from("table_sessions").select("*").eq("restaurant_id", rid).neq("status", "closed"),
    db.from("calls").select("*").eq("restaurant_id", rid).is("resolved_at", null).order("at"),
    db.from("menu_items").select("*").eq("restaurant_id", rid).order("name"),
    db.from("table_sessions").select("id, total").eq("restaurant_id", rid).gte("paid_at", startOfDay.toISOString()),
  ]);
  const open = (sessions.data ?? []) as Session[];
  const ids = open.map((s) => s.id);
  const todayIds = (paidToday.data ?? []).map((s: { id: string }) => s.id);
  const allIds = [...new Set([...ids, ...todayIds])];
  const [orders, lines, payments, members] = await Promise.all([
    ids.length ? db.from("orders").select("*").in("session_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? db.from("order_lines").select("*").in("session_id", ids).order("created_at") : Promise.resolve({ data: [] }),
    allIds.length ? db.from("payments").select("*").in("session_id", allIds) : Promise.resolve({ data: [] }),
    open.some((s) => s.member_id) ? db.from("members").select("*").in("id", open.map((s) => s.member_id).filter(Boolean) as string[]) : Promise.resolve({ data: [] }),
  ]);
  const pays = (payments.data ?? []) as Payment[];
  return {
    tables: (tables.data ?? []) as DiningTable[],
    sessions: open,
    orders: (orders.data ?? []) as Order[],
    lines: (lines.data ?? []) as Line[],
    payments: pays,
    calls: (calls.data ?? []) as Call[],
    members: (members.data ?? []) as Member[],
    items: (items.data ?? []) as MenuItem[],
    today: (paidToday.data ?? []).map((s: { id: string; total: number | null }) => ({ total: s.total, payments: pays.filter((p) => p.session_id === s.id) })),
  };
}

type TState = "free" | "confirm" | "ordered" | "cooking" | "eating" | "bill" | "paid";
const tiles: Record<TState, { label: string; cls: string }> = {
  free: { label: "Free", cls: "bg-card border-line-2 text-ink-2" },
  confirm: { label: "Confirm order", cls: "bg-turmeric border-turmeric text-[#241800]" },
  ordered: { label: "Seated", cls: "bg-indigo-tint border-indigo/40 text-indigo" },
  cooking: { label: "Cooking", cls: "bg-indigo border-indigo text-white" },
  eating: { label: "Eating", cls: "bg-leaf-tint border-leaf/40 text-leaf" },
  bill: { label: "Bill", cls: "bg-madder border-madder text-white" },
  paid: { label: "Paid, clear", cls: "bg-ground border-ink-2 border-dashed text-ink-2" },
};

const callText: Record<string, string> = { waiter: "Needs a waiter", water: "Water", cutlery: "Cutlery", bill: "Bill", help: "Needs help" };

export function PosApp({ restaurant: r, staff }: { restaurant: Restaurant; staff: Staff }) {
  const { data, online } = useLive(r.id, ["table_sessions", "orders", "order_lines", "payments", "calls", "dining_tables", "menu_items"], () => load(r.id));
  const now = useNow(10_000);
  const [openTable, setOpenTable] = useState<string | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const act = async (body: object, ok?: string) => {
    const { error, data: res } = await call("/api/staff", body);
    setMsg(error ?? ok ?? null);
    return { error, res };
  };

  const view = useMemo(() => {
    if (!data) return null;
    const sessionOf = new Map(data.sessions.map((s) => [s.table_id, s]));
    const state = (t: DiningTable): TState => {
      const s = sessionOf.get(t.id);
      if (!s) return "free";
      if (s.status === "paid") return "paid";
      if (s.status === "bill") return "bill";
      const lines = data.lines.filter((l) => l.session_id === s.id && l.status !== "cancelled");
      if (lines.some((l) => l.status === "pending")) return "confirm";
      if (lines.some((l) => l.status === "queued" || l.status === "cooking" || l.status === "ready")) return "cooking";
      if (lines.length) return "eating";
      return "ordered";
    };
    const tableOfSession = new Map(data.sessions.map((s) => [s.id, data.tables.find((t) => t.id === s.table_id)]));
    return {
      sessionOf,
      state,
      tableOfSession,
      pending: data.orders.filter((o) => !o.confirmed_at && data.lines.some((l) => l.order_id === o.id && l.status === "pending")),
      claimed: data.payments.filter((p) => p.status === "claimed"),
      ready: data.lines.filter((l) => l.status === "ready"),
      areas: [...new Set(data.tables.map((t) => t.area))],
    };
  }, [data]);

  // Different chimes for a QR order to confirm, a table calling, and a UPI payment to check.
  const sound = useSound("pos");
  useNewItems(view ? view.pending.map((o) => o.id) : null, () => sound.play("confirm"));
  useNewItems(data ? data.calls.map((c) => c.id) : null, () => sound.play("call"));
  useNewItems(view ? view.claimed.map((p) => p.id) : null, () => sound.play("payment"));
  useTitleCount(view ? view.pending.length + (data?.calls.length ?? 0) + view.claimed.length : 0, "Cashier · Astra Dine");

  if (!data || !view) return <main className="grid min-h-dvh place-items-center text-muted">Loading the floor…</main>;
  const takings = data.today.reduce((s, x) => s + (x.total ?? 0), 0);
  const byMode = data.today.flatMap((x) => x.payments).filter((p) => p.status === "confirmed").reduce((m, p) => ((m[p.mode] = (m[p.mode] ?? 0) + p.amount), m), {} as Record<string, number>);
  const label = (sessionId: string) => view.tableOfSession.get(sessionId)?.label ?? "?";

  return (
    <div className="min-h-dvh">
      <header className="border-line bg-card flex flex-wrap items-center gap-x-5 gap-y-2 border-b px-4 py-2.5">
        <div>
          <p className="dish text-lg leading-tight">{r.name}</p>
          <p className="text-muted text-xs">Cashier, {staff.name}</p>
        </div>
        <span className={`flex items-center gap-1.5 text-xs ${online ? "text-muted" : "text-madder font-bold"}`}>
          <span aria-hidden="true" className={`size-2 rounded-full ${online ? "bg-[#3fbf63]" : "bg-madder"}`} />
          {online ? "Live" : "Reconnecting…"}
        </span>
        <span className="text-ink-2 ml-auto text-sm">
          Today <b className="num">{inr(takings)}</b> from {data.today.length} bills
        </span>
        <button type="button" onClick={sound.toggle} aria-pressed={sound.on} className={`btn !min-h-10 text-sm ${sound.on ? "btn-quiet" : "btn-turmeric"}`}>
          {sound.on ? <Volume2 className="size-4" aria-hidden="true" /> : <VolumeX className="size-4" aria-hidden="true" />}
          {sound.on ? "Sound on" : "Turn sound on"}
        </button>
        <button type="button" className="btn btn-line !min-h-10 text-sm" onClick={() => setGiftOpen(true)}>
          <Gift className="size-4" aria-hidden="true" />
          Sell gift card
        </button>
        <SignOut className="btn btn-quiet !min-h-10 text-sm" />
      </header>
      {msg ? (
        <p role="status" className="bg-ink px-4 py-2 text-sm font-bold text-white">
          {msg}{" "}
          <button type="button" className="ml-2 underline" onClick={() => setMsg(null)}>
            Dismiss
          </button>
        </p>
      ) : null}

      <div className="grid gap-5 p-4 lg:grid-cols-[22rem_1fr]">
        <aside className="min-w-0 space-y-4" aria-label="Needs attention">
          {view.claimed.length ? (
            <section aria-labelledby="upi" className="border-turmeric rounded-xl border-2 bg-[#fffaf0] p-4">
              <h2 id="upi" className="font-bold">
                Check these UPI payments
              </h2>
              <p className="text-ink-2 text-sm">The guest says they paid. Check your UPI app or soundbox, then confirm.</p>
              <ul className="mt-2 space-y-2">
                {view.claimed.map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <span className="bg-ink num flex size-10 shrink-0 items-center justify-center rounded-lg font-bold text-white">{label(p.session_id)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="num block font-bold">{inr(p.amount)}</span>
                      <span className="text-muted text-sm">{ago(p.at, now)} ago</span>
                    </span>
                    <button type="button" className="btn btn-primary !min-h-10 !px-3 text-sm" onClick={() => void act({ type: "reviewPayment", paymentId: p.id, ok: true }, "Payment confirmed.")}>
                      Received
                    </button>
                    <button type="button" className="btn btn-line !min-h-10 !px-2.5" aria-label={`Not received from table ${label(p.session_id)}`} onClick={() => void act({ type: "reviewPayment", paymentId: p.id, ok: false })}>
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="confirm" className="bg-card border-line rounded-xl border p-4">
            <h2 id="confirm" className="font-bold">
              QR orders to confirm <span className="num text-muted">{view.pending.length}</span>
            </h2>
            <p className="text-muted text-sm">A table&apos;s first order waits for you, so nobody can order from outside.</p>
            <ul className="mt-2 space-y-3">
              {view.pending.map((o) => (
                <li key={o.id} className="bg-turmeric-tint rounded-lg p-3">
                  <div className="flex justify-between">
                    <span className="font-bold">Table {label(o.session_id)}</span>
                    <span className="text-turmeric-ink text-sm">{ago(o.placed_at, now)}</span>
                  </div>
                  <p className="text-ink-2 mt-1 text-sm">
                    {data.lines.filter((l) => l.order_id === o.id).map((l) => `${l.qty} × ${l.name}`).join(", ")}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="btn btn-primary !min-h-10 flex-1" onClick={() => void act({ type: "confirmOrder", orderId: o.id, accept: true }, "Sent to the kitchen.")}>
                      <Check className="size-4" aria-hidden="true" />
                      Confirm, send to kitchen
                    </button>
                    <button type="button" className="btn btn-line !min-h-10 !px-3" aria-label={`Turn down table ${label(o.session_id)} order`} onClick={() => void act({ type: "confirmOrder", orderId: o.id, accept: false })}>
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
              {!view.pending.length ? <li className="text-muted text-sm">None waiting.</li> : null}
            </ul>
          </section>

          <section aria-labelledby="calls" className="bg-card border-line rounded-xl border p-4">
            <h2 id="calls" className="flex items-center gap-2 font-bold">
              <BellRing className="size-4" aria-hidden="true" />
              Tables calling <span className="num text-muted">{data.calls.length}</span>
            </h2>
            <ul className="mt-2 space-y-2">
              {data.calls.map((c) => (
                <li key={c.id} className="flex items-center gap-3">
                  <span className={`num flex size-10 shrink-0 items-center justify-center rounded-lg font-bold text-white ${c.kind === "bill" ? "bg-madder" : "bg-ink"}`}>
                    {data.tables.find((t) => t.id === c.table_id)?.label}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{callText[c.kind]}</span>
                    <span className={`text-sm ${minsSince(c.at, now) >= 3 ? "text-madder font-bold" : "text-muted"}`}>{ago(c.at, now)} waiting</span>
                  </span>
                  <button type="button" className="btn btn-line !min-h-10 text-sm" onClick={() => void act({ type: "resolveCall", callId: c.id })}>
                    Done
                  </button>
                </li>
              ))}
              {!data.calls.length ? <li className="text-muted text-sm">Nobody calling.</li> : null}
            </ul>
          </section>

          <section aria-labelledby="pass" className="bg-card border-line rounded-xl border p-4">
            <h2 id="pass" className="font-bold">
              Ready to serve <span className="num text-muted">{view.ready.length}</span>
            </h2>
            <ul className="mt-2 space-y-2">
              {view.ready.map((l) => (
                <li key={l.id} className="flex items-center gap-3">
                  <span className="bg-leaf num flex size-10 shrink-0 items-center justify-center rounded-lg font-bold text-white">{label(l.session_id)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">
                      {l.qty} × {l.name}
                    </span>
                    <span className="text-muted text-sm">Ready {ago(l.ready_at, now)} ago</span>
                  </span>
                  <button type="button" className="btn btn-line !min-h-10 text-sm" onClick={() => void act({ type: "lines", lineIds: [l.id], status: "served" })}>
                    Served
                  </button>
                </li>
              ))}
              {!view.ready.length ? <li className="text-muted text-sm">Nothing at the pass.</li> : null}
            </ul>
          </section>

          <section aria-labelledby="mix" className="bg-card border-line rounded-xl border p-4 text-sm">
            <h2 id="mix" className="font-bold">
              Collected today
            </h2>
            <dl className="mt-2 space-y-1">
              {(["upi", "cash", "card", "gift"] as const).map((m) => (
                <div key={m} className="flex justify-between">
                  <dt>{m === "upi" ? "UPI" : m === "gift" ? "Gift cards" : m[0]!.toUpperCase() + m.slice(1)}</dt>
                  <dd className="num">{inr(byMode[m] ?? 0)}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>

        <main className="min-w-0">
          {data.tables.length ? null : <p className="text-ink-2">No tables yet. The owner adds them in the admin dashboard, under Tables and QR codes.</p>}
          {view.areas.map((area) => (
            <section key={area} aria-label={area} className="mb-5">
              <h2 className="dish text-xl">{area}</h2>
              <ul className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
                {data.tables
                  .filter((t) => t.area === area)
                  .map((t) => {
                    const st = view.state(t);
                    const s = view.sessionOf.get(t.id);
                    const calling = data.calls.some((c) => c.table_id === t.id);
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => setOpenTable(t.id)}
                          className={`relative flex h-24 w-full flex-col justify-between rounded-xl border-2 p-2.5 text-left ${tiles[st].cls}`}
                          aria-label={`Table ${t.label}, ${tiles[st].label}${calling ? ", calling" : ""}`}
                        >
                          <span className="flex items-start justify-between">
                            <span className="num text-2xl leading-none font-bold">{t.label}</span>
                            {calling ? <BellRing className="size-4" aria-hidden="true" /> : null}
                          </span>
                          <span className="text-xs leading-tight font-bold">
                            {tiles[st].label}
                            <span className="block font-normal">{s ? `${s.guests} guests, ${ago(s.opened_at, now)}` : `${t.seats} seats`}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
        </main>
      </div>

      {openTable ? <TableSheet r={r} data={data} tableId={openTable} onClose={() => setOpenTable(null)} act={act} /> : null}
      {giftOpen ? <GiftSheet onClose={() => setGiftOpen(false)} act={act} /> : null}
    </div>
  );
}

function TableSheet({ r, data, tableId, onClose, act }: { r: Restaurant; data: Data; tableId: string; onClose: () => void; act: (b: object, ok?: string) => Promise<{ error: string | null }> }) {
  const t = data.tables.find((x) => x.id === tableId)!;
  const s = data.sessions.find((x) => x.table_id === tableId);
  const [taking, setTaking] = useState(false);
  const [guests, setGuests] = useState(2);
  const [phone, setPhone] = useState("");
  const [gift, setGift] = useState("");
  if (taking) return <TakeOrder items={data.items} table={t} onClose={() => setTaking(false)} act={act} />;
  const lines = s ? data.lines.filter((l) => l.session_id === s.id) : [];
  const payments = s ? data.payments.filter((p) => p.session_id === s.id) : [];
  const bill = s ? billFor(r, s, lines, payments) : null;
  const member = s?.member_id ? data.members.find((m) => m.id === s.member_id) : undefined;
  return (
    <Sheet title={`Table ${t.label}`} onClose={onClose}>
      <p className="text-ink-2">
        {t.area}, {t.seats} seats
      </p>
      {!s ? (
        <div className="mt-4">
          <label className="label" htmlFor="guests">
            Guests
          </label>
          <div className="flex gap-2">
            <input id="guests" type="number" min={1} max={30} className="field !w-24" value={guests} onChange={(e) => setGuests(Number(e.target.value) || 1)} />
            <button
              type="button"
              className="btn btn-primary flex-1"
              onClick={async () => {
                const { error } = await act({ type: "seat", tableId, guests });
                if (!error) setTaking(true);
              }}
            >
              Seat and take order
            </button>
          </div>
          <p className="text-muted mt-2 text-sm">Or let the guests scan the table QR and order themselves.</p>
        </div>
      ) : (
        <div className="print-bill">
          <p className="mt-1 text-sm">
            {s.guests} guests, seated {ago(s.opened_at)}
            {s.bill_no ? `, bill #${s.bill_no}` : ""}
          </p>
          {member ? (
            <p className="bg-turmeric-tint text-turmeric-ink mt-2 rounded-lg px-3 py-2 text-sm font-bold">
              {member.name ?? member.phone}: {member.stamps} of {r.stamps_for_reward} stamps{member.rewards_ready ? `, ${member.rewards_ready} reward ready` : ""}
            </p>
          ) : null}
          <ul className="divide-line mt-3 divide-y">
            {lines.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                <span className={l.status === "cancelled" ? "text-muted line-through" : ""}>
                  {l.qty} × {l.name}
                  <span className="text-muted block text-xs">{[l.variant, ...l.addons, l.note].filter(Boolean).join(", ") || (l.status === "pending" ? "waiting for you to confirm" : l.status)}</span>
                </span>
                <span className="num text-sm">{inr(l.unit_price * l.qty)}</span>
              </li>
            ))}
          </ul>
          {bill ? (
            <dl className="num mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd>{inr(bill.subtotal)}</dd>
              </div>
              {bill.discount ? (
                <div className="text-leaf flex justify-between">
                  <dt>{s.discount_label}</dt>
                  <dd>− {inr(bill.discount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt>GST {r.gst_pct}% (CGST and SGST)</dt>
                <dd>{inr(bill.gst)}</dd>
              </div>
              <div className="border-line-2 flex justify-between border-t pt-1.5 text-lg font-bold">
                <dt>Total</dt>
                <dd>{inr(bill.total)}</dd>
              </div>
              {payments.filter((p) => p.status !== "rejected").map((p) => (
                <div key={p.id} className="flex justify-between">
                  <dt>
                    {p.mode.toUpperCase()} {p.status === "claimed" ? "(to check)" : ""}
                  </dt>
                  <dd>{inr(p.amount)}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {s.status !== "paid" ? (
            <div className="print:hidden">
              {!member ? (
                <form
                  className="mt-4 flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const { error } = await act({ type: "member", sessionId: s.id, phone }, "Guest added to rewards.");
                    if (!error) setPhone("");
                  }}
                >
                  <input className="field" inputMode="tel" placeholder="Guest's phone for rewards" aria-label="Guest's phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  <button type="submit" className="btn btn-line shrink-0" disabled={phone.replace(/\D/g, "").length < 10}>
                    Add
                  </button>
                </form>
              ) : member.rewards_ready && !s.discount ? (
                <button type="button" className="btn btn-turmeric mt-4" onClick={() => void act({ type: "applyReward", sessionId: s.id }, "Reward applied.")}>
                  <Gift className="size-4" aria-hidden="true" />
                  Apply reward: {r.reward_text.toLowerCase()}
                </button>
              ) : null}
              <div className="mt-4 grid grid-cols-2 gap-2">
                {s.status === "seated" ? (
                  <>
                    <button type="button" className="btn btn-line" onClick={() => setTaking(true)}>
                      Add to order
                    </button>
                    <button type="button" className="btn btn-line" onClick={() => void act({ type: "requestBill", sessionId: s.id })}>
                      Make the bill
                    </button>
                  </>
                ) : null}
              </div>
              {bill && bill.total > 0 ? (
                <>
                  <p className="mt-4 font-bold">Take payment: {inr(bill.due)}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(["upi", "cash", "card"] as const).map((m) => (
                      <button key={m} type="button" disabled={!bill.due} className="btn btn-primary !min-h-12" onClick={() => void act({ type: "pay", sessionId: s.id, mode: m }, "Payment recorded.")}>
                        {m === "upi" ? "UPI" : m === "cash" ? "Cash" : "Card"}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input className="field uppercase" placeholder="Gift card code" aria-label="Gift card code" value={gift} onChange={(e) => setGift(e.target.value)} />
                    <button type="button" className="btn btn-line shrink-0" disabled={!gift.trim() || !bill.due} onClick={() => void act({ type: "pay", sessionId: s.id, mode: "gift", giftCode: gift.trim() }, "Gift card applied.")}>
                      Redeem
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2 print:hidden">
              <button type="button" className="btn btn-line" onClick={() => window.print()}>
                <Printer className="size-4" aria-hidden="true" />
                Print bill
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  const { error } = await act({ type: "close", sessionId: s.id }, `Table ${t.label} is free.`);
                  if (!error) onClose();
                }}
              >
                Table cleared, free it
              </button>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function TakeOrder({ items, table, onClose, act }: { items: MenuItem[]; table: DiningTable; onClose: () => void; act: (b: object, ok?: string) => Promise<{ error: string | null }> }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Record<string, number>>({});
  const list = items.filter((m) => m.available && m.name.toLowerCase().includes(q.trim().toLowerCase()));
  const n = Object.values(picked).reduce((s, x) => s + x, 0);
  const change = (id: string, d: number) => setPicked((p) => ({ ...p, [id]: Math.max(0, (p[id] ?? 0) + d) }));
  return (
    <Sheet
      title={`Order for table ${table.label}`}
      onClose={onClose}
      footer={
        <button
          type="button"
          disabled={!n}
          className="btn btn-primary !min-h-12 w-full"
          onClick={async () => {
            const lines = Object.entries(picked)
              .filter(([, qty]) => qty > 0)
              .map(([itemId, qty]) => ({ itemId, qty, addonIds: [], variantId: items.find((m) => m.id === itemId)?.variants.at(-1)?.id ?? null }));
            const { error } = await act({ type: "staffOrder", tableId: table.id, lines }, "Sent to the kitchen.");
            if (!error) onClose();
          }}
        >
          Send {n} to kitchen
        </button>
      }
    >
      <div className="relative">
        <Search className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden="true" />
        <input type="search" className="field !pl-9" placeholder="Type a dish" aria-label="Find a dish" value={q} onChange={(e) => setQ(e.target.value)} data-autofocus />
      </div>
      <ul className="divide-line mt-2 divide-y">
        {list.map((m) => (
          <li key={m.id} className="flex min-h-12 items-center gap-3">
            <DietMark diet={m.diet} />
            <span className="flex-1">{m.name}</span>
            <span className="flex items-center">
              <button type="button" className="flex size-10 items-center justify-center" aria-label={`One less ${m.name}`} onClick={() => change(m.id, -1)}>
                <Minus className="size-4" aria-hidden="true" />
              </button>
              <span className="num w-5 text-center font-bold">{picked[m.id] ?? 0}</span>
              <button type="button" className="text-indigo flex size-10 items-center justify-center" aria-label={`One more ${m.name}`} onClick={() => change(m.id, 1)}>
                <Plus className="size-4" aria-hidden="true" />
              </button>
            </span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function GiftSheet({ onClose, act }: { onClose: () => void; act: (b: object, ok?: string) => Promise<{ error: string | null; res?: Record<string, unknown> }> }) {
  const [value, setValue] = useState(1000);
  const [to, setTo] = useState("");
  const [from, setFrom] = useState("");
  const [code, setCode] = useState<string | null>(null);
  return (
    <Sheet title="Sell a gift card" onClose={onClose}>
      {code ? (
        <div>
          <p className="text-ink-2">Gift card created. Give this code to the guest, or send it to them on WhatsApp.</p>
          <p className="num bg-turmeric-tint mt-3 rounded-xl p-4 text-center text-3xl font-bold tracking-wider">{code}</p>
          <button type="button" className="btn btn-primary mt-4 w-full" onClick={onClose}>
            Done
          </button>
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const { error, res } = await act({ type: "issueGift", value, to: to.trim(), from: from.trim() });
            if (!error && typeof res?.code === "string") setCode(res.code);
          }}
        >
          <p className="text-ink-2 text-sm">Take the payment first (UPI, cash or card), then create the card.</p>
          <fieldset className="mt-3">
            <legend className="label">Value</legend>
            <div className="flex gap-2">
              {[500, 1000, 2000, 5000].map((v) => (
                <label key={v} className="border-line-2 has-checked:border-indigo has-checked:bg-indigo-tint flex min-h-11 flex-1 items-center justify-center rounded-[var(--radius-ctl)] border-[1.5px] font-bold">
                  <input type="radio" name="value" className="sr-only" checked={value === v} onChange={() => setValue(v)} />
                  {inr(v)}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="label mt-4" htmlFor="to">
            For
          </label>
          <input id="to" className="field" required maxLength={40} value={to} onChange={(e) => setTo(e.target.value)} />
          <label className="label mt-3" htmlFor="from">
            From
          </label>
          <input id="from" className="field" maxLength={40} value={from} onChange={(e) => setFrom(e.target.value)} />
          <button type="submit" className="btn btn-primary mt-5 w-full">
            Create gift card
          </button>
        </form>
      )}
    </Sheet>
  );
}
