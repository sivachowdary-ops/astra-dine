"use client";

import { useLive, useNow } from "@/lib/live";
import { ago, inr } from "@/lib/rules";
import { browserClient } from "@/lib/supabase/browser";
import type { Call, DiningTable, Line, Order, Payment, Restaurant, Session } from "@/lib/types";
import { useEffect, useState } from "react";
import { CircleCheck, Circle, ChevronRight } from "lucide-react";
import { Figure, H, type Section } from "./admin-app";

type Data = { sessions: Session[]; lines: Line[]; orders: Order[]; payments: Payment[]; calls: Call[]; tables: DiningTable[] };

async function load(rid: string): Promise<Data> {
  const db = browserClient();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const iso = start.toISOString();
  const [sessions, lines, orders, payments, calls, tables] = await Promise.all([
    db.from("table_sessions").select("*").eq("restaurant_id", rid).or(`status.neq.closed,paid_at.gte.${iso},opened_at.gte.${iso}`),
    db.from("order_lines").select("*").eq("restaurant_id", rid).gte("created_at", iso),
    db.from("orders").select("*").eq("restaurant_id", rid).gte("placed_at", iso).order("placed_at", { ascending: false }),
    db.from("payments").select("*").eq("restaurant_id", rid).gte("at", iso).order("at", { ascending: false }),
    db.from("calls").select("*").eq("restaurant_id", rid).is("resolved_at", null),
    db.from("dining_tables").select("*").eq("restaurant_id", rid),
  ]);
  return {
    sessions: (sessions.data ?? []) as Session[],
    lines: (lines.data ?? []) as Line[],
    orders: (orders.data ?? []) as Order[],
    payments: (payments.data ?? []) as Payment[],
    calls: (calls.data ?? []) as Call[],
    tables: (tables.data ?? []) as DiningTable[],
  };
}

export function TodaySection({ restaurant: r, go }: { restaurant: Restaurant; go: (s: Section) => void }) {
  const { data, online } = useLive(r.id, ["table_sessions", "order_lines", "orders", "payments", "calls"], () => load(r.id));
  const now = useNow(30_000);
  if (!data) return <p className="text-muted">Loading today…</p>;
  const paid = data.sessions.filter((s) => s.paid_at);
  const sales = paid.reduce((s, x) => s + (x.total ?? 0), 0);
  const open = data.sessions.filter((s) => s.status !== "closed" && s.status !== "paid");
  const running = data.lines.filter((l) => open.some((s) => s.id === l.session_id) && !["cancelled", "pending"].includes(l.status)).reduce((s, l) => s + l.unit_price * l.qty, 0);
  const guests = data.sessions.filter((s) => s.paid_at || s.status !== "closed").reduce((s, x) => s + x.guests, 0);
  const qr = paid.length ? paid.filter((s) => s.via_qr).length / paid.length : 0;
  const times = data.lines.filter((l) => l.ready_at && l.fired_at).map((l) => new Date(l.ready_at!).getTime() - new Date(l.fired_at!).getTime());
  const kitchen = times.length ? Math.round(times.reduce((s, x) => s + x, 0) / times.length / 60_000) : null;
  const dishes = new Map<string, number>();
  data.lines.filter((l) => l.status !== "cancelled").forEach((l) => dishes.set(l.name, (dishes.get(l.name) ?? 0) + l.qty));
  const top = [...dishes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const tableOf = (sessionId: string) => data.tables.find((t) => t.id === data.sessions.find((s) => s.id === sessionId)?.table_id)?.label ?? "?";
  const feed = [
    ...data.orders.map((o) => ({ at: o.placed_at, text: `Table ${tableOf(o.session_id)}: KOT ${o.kot}, ${o.source === "qr" ? "QR order" : "staff order"}${o.confirmed_at ? "" : ", waiting for staff"}` })),
    ...data.payments.map((p) => ({ at: p.at, text: `Table ${tableOf(p.session_id)} paid ${inr(p.amount)} by ${p.mode.toUpperCase()}${p.status === "claimed" ? " (being checked)" : ""}` })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 12);

  return (
    <>
      <H sub={`Live from the tables, kitchen and cashier${online ? "" : " (reconnecting…)"}.`}>Today</H>
      <Setup restaurant={r} go={go} />
      <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Figure k="Collected" v={inr(sales)} sub={`${paid.length} bills, ${inr(running)} still at tables`} />
        <Figure k="Average bill" v={inr(paid.length ? sales / paid.length : 0)} sub={`${guests} guests today`} />
        <Figure k="Ordered by QR" v={`${Math.round(qr * 100)}%`} sub="of paid tables" />
        <Figure k="Kitchen time" v={kitchen !== null ? `${kitchen} min` : "–"} sub="order to ready, average today" />
      </dl>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <section aria-labelledby="floor" className="bg-card border-line rounded-xl border p-4">
          <h2 id="floor" className="font-bold">
            On the floor now
          </h2>
          <dl className="mt-2 grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-muted">Tables seated</dt>
              <dd className="num text-xl font-bold">
                {open.length}/{data.tables.length}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Waiting on staff</dt>
              <dd className="num text-xl font-bold">{data.calls.length}</dd>
            </div>
            <div>
              <dt className="text-muted">Bills asked</dt>
              <dd className="num text-xl font-bold">{open.filter((s) => s.status === "bill").length}</dd>
            </div>
          </dl>
          <h3 className="mt-5 font-bold">Latest</h3>
          {feed.length ? (
            <ol className="mt-2 space-y-2">
              {feed.map((f, i) => (
                <li key={`${f.at}-${i}`} className="flex gap-3 text-sm">
                  <span className="text-muted num w-20 shrink-0">{ago(f.at, now)} ago</span>
                  <span>{f.text}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted mt-2 text-sm">No orders yet today.</p>
          )}
        </section>
        <section aria-labelledby="top" className="bg-card border-line rounded-xl border p-4">
          <h2 id="top" className="font-bold">
            Selling most today
          </h2>
          {top.length ? (
            <ol className="mt-2 space-y-2">
              {top.map(([name, n], i) => (
                <li key={name}>
                  <div className="flex justify-between text-sm">
                    <span>{name}</span>
                    <span className="num font-bold">{n}</span>
                  </div>
                  <span aria-hidden="true" className="bg-ground mt-1 block h-1.5 overflow-hidden rounded-full">
                    <span className={`block h-full ${i === 0 ? "bg-turmeric" : "bg-indigo"}`} style={{ width: `${(n / (top[0]?.[1] ?? 1)) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted mt-2 text-sm">Nothing sold yet today.</p>
          )}
        </section>
      </div>
    </>
  );
}

type Step = { done: boolean; title: string; why: string; to: Section };

/** What a new restaurant still needs before guests can scan and order. Hidden once all done. */
function Setup({ restaurant: r, go }: { restaurant: Restaurant; go: (s: Section) => void }) {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [hidden, setHidden] = useState(true);
  const key = `dine-setup-hidden-${r.id}`;
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        setHidden(localStorage.getItem(key) === "1");
      } catch {
        setHidden(false);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [key]);
  useEffect(() => {
    const db = browserClient();
    void Promise.all([
      db.from("menu_items").select("image_url").eq("restaurant_id", r.id),
      db.from("dining_tables").select("id", { count: "exact", head: true }).eq("restaurant_id", r.id),
      db.from("staff").select("role, active").eq("restaurant_id", r.id),
    ]).then(([items, tables, staff]) => {
      const dishes = (items.data ?? []) as { image_url: string | null }[];
      const withPhoto = dishes.filter((d) => d.image_url).length;
      const roles = new Set(((staff.data ?? []) as { role: string; active: boolean }[]).filter((s) => s.active).map((s) => s.role));
      setSteps([
        { done: dishes.length >= 5, title: "Add your menu", why: dishes.length ? `${dishes.length} dishes so far` : "Prices, sizes, add-ons and veg marks", to: "menu" },
        { done: dishes.length > 0 && withPhoto / dishes.length >= 0.6, title: "Add dish photos", why: `${withPhoto} of ${dishes.length} dishes have one. Photos sell.`, to: "menu" },
        { done: Boolean(r.cover_url && r.logo_url), title: "Cover photo and logo", why: "The top of the menu on every phone", to: "settings" },
        { done: (tables.count ?? 0) > 0, title: "Tables and QR codes", why: tables.count ? `${tables.count} tables. Print the QR cards.` : "One QR per table", to: "tables" },
        { done: roles.has("kitchen") && roles.has("cashier"), title: "Kitchen and cashier logins", why: "Each screen signs in on its own device", to: "staff" },
        { done: Boolean(r.upi_vpa), title: "Your UPI ID", why: "Guests pay you directly from their phone", to: "settings" },
        { done: Boolean(r.google_review_url), title: "Google review link", why: "Happy guests are asked for a review", to: "settings" },
      ]);
    });
  }, [r]);
  if (hidden || !steps || steps.every((s) => s.done)) return null;
  const done = steps.filter((s) => s.done).length;
  return (
    <section aria-labelledby="setup" className="bg-card border-line mb-6 rounded-xl border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="setup" className="font-bold">
          Ready to open: {done} of {steps.length} done
        </h2>
        <span className="flex items-center gap-3">
          <span aria-hidden="true" className="bg-ground block h-2 w-40 overflow-hidden rounded-full">
            <span className="bg-leaf block h-full" style={{ width: `${(done / steps.length) * 100}%` }} />
          </span>
          <button
            type="button"
            className="btn btn-quiet !min-h-8 text-sm"
            onClick={() => {
              setHidden(true);
              try {
                localStorage.setItem(key, "1");
              } catch {
                // Hidden for this visit only.
              }
            }}
          >
            Hide
          </button>
        </span>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((s) => (
          <li key={s.title}>
            <button type="button" onClick={() => go(s.to)} className={`flex w-full items-start gap-2 rounded-lg border p-3 text-left ${s.done ? "border-line text-muted" : "border-line-2 hover:bg-ground"}`}>
              {s.done ? <CircleCheck className="text-leaf mt-0.5 size-5 shrink-0" aria-hidden="true" /> : <Circle className="text-line-2 mt-0.5 size-5 shrink-0" aria-hidden="true" />}
              <span className="min-w-0 flex-1">
                <span className={`block font-bold ${s.done ? "line-through decoration-1" : ""}`}>{s.title}</span>
                <span className="block text-sm">{s.done ? "Done" : s.why}</span>
              </span>
              {!s.done ? <ChevronRight className="text-muted mt-0.5 size-4 shrink-0" aria-hidden="true" /> : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
