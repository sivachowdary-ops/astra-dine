"use client";

import { useMemo, useState } from "react";
import { Ban, Search } from "lucide-react";
import { call, useLive, useNow } from "@/lib/live";
import { clock, stationNames } from "@/lib/rules";
import { browserClient } from "@/lib/supabase/browser";
import type { DiningTable, Line, MenuItem, Order, Restaurant, Session, Staff } from "@/lib/types";
import { Sheet } from "../bits";
import { SignOut } from "../staff-login";

type Data = { orders: Order[]; lines: Line[]; sessions: Session[]; tables: DiningTable[]; items: MenuItem[] };

async function load(restaurantId: string): Promise<Data> {
  const db = browserClient();
  const since = new Date(Date.now() - 6 * 3_600_000).toISOString();
  const [lines, orders, sessions, tables, items] = await Promise.all([
    db.from("order_lines").select("*").eq("restaurant_id", restaurantId).in("status", ["queued", "cooking", "ready"]).gte("created_at", since),
    db.from("orders").select("*").eq("restaurant_id", restaurantId).gte("placed_at", since),
    db.from("table_sessions").select("*").eq("restaurant_id", restaurantId).neq("status", "closed"),
    db.from("dining_tables").select("*").eq("restaurant_id", restaurantId),
    db.from("menu_items").select("*").eq("restaurant_id", restaurantId).order("name"),
  ]);
  return {
    lines: (lines.data ?? []) as Line[],
    orders: (orders.data ?? []) as Order[],
    sessions: (sessions.data ?? []) as Session[],
    tables: (tables.data ?? []) as DiningTable[],
    items: (items.data ?? []) as MenuItem[],
  };
}

/**
 * The kitchen display: one slip per order, oldest first, coloured against the slowest dish's
 * usual time. Tap a dish to move it on, or the slip's button to move all of it.
 */
export function KitchenApp({ restaurant, staff }: { restaurant: Restaurant; staff: Staff }) {
  const { data, online } = useLive(restaurant.id, ["order_lines", "orders", "menu_items", "table_sessions"], () => load(restaurant.id));
  const now = useNow(1000);
  const [station, setStation] = useState("all");
  const [soldOpen, setSoldOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stations = useMemo(() => [...new Set((data?.items ?? []).map((i) => i.station))].sort(), [data]);
  const tickets = useMemo(() => {
    if (!data) return [];
    const tableOf = new Map(data.sessions.map((s) => [s.id, data.tables.find((t) => t.id === s.table_id)?.label ?? "?"]));
    return data.orders
      .filter((o) => o.confirmed_at)
      .map((o) => ({ order: o, table: tableOf.get(o.session_id) ?? "?", lines: data.lines.filter((l) => l.order_id === o.id && (station === "all" || l.station === station)) }))
      .filter((t) => t.lines.some((l) => l.status === "queued" || l.status === "cooking"))
      .sort((a, b) => (a.order.confirmed_at ?? "").localeCompare(b.order.confirmed_at ?? ""));
  }, [data, station]);

  const allDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tickets) for (const l of t.lines) if (l.status === "queued" || l.status === "cooking") m.set(l.name, (m.get(l.name) ?? 0) + l.qty);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [tickets]);

  const move = async (lineIds: string[], status: "cooking" | "ready") => {
    const { error: err } = await call("/api/staff", { type: "lines", lineIds, status });
    setError(err);
  };

  if (!data) return <main className="bg-pass grid min-h-dvh place-items-center text-white/70">Loading tickets…</main>;
  const prep = new Map(data.items.map((i) => [i.id, i.prep_minutes]));
  const soldOut = data.items.filter((i) => !i.available).length;

  return (
    <div className="bg-pass min-h-dvh text-white">
      <header className="border-pass-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-b px-4 py-2.5">
        <div>
          <p className="dish text-lg leading-tight">{restaurant.name}</p>
          <p className="text-xs text-white/60">Kitchen, signed in as {staff.name}</p>
        </div>
        <span className={`flex items-center gap-1.5 text-xs ${online ? "text-white/60" : "text-madder font-bold"}`}>
          <span aria-hidden="true" className={`size-2 rounded-full ${online ? "bg-[#3fbf63]" : "bg-madder"}`} />
          {online ? "Live" : "Reconnecting…"}
        </span>
        <span className="num ml-auto text-2xl font-bold">{new Date(now).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>
        <SignOut className="rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10" />
      </header>

      <div className="border-pass-3 flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <div role="tablist" aria-label="Station" className="flex flex-wrap gap-1">
          {["all", ...stations].map((s) => (
            <button
              key={s}
              role="tab"
              type="button"
              aria-selected={station === s}
              onClick={() => setStation(s)}
              className={`min-h-11 rounded-lg px-4 text-[0.95rem] font-bold ${station === s ? "bg-white text-black" : "bg-pass-2 text-white/80"}`}
            >
              {s === "all" ? "All stations" : (stationNames[s] ?? s)}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setSoldOpen(true)} className="bg-pass-2 ml-auto flex min-h-11 items-center gap-2 rounded-lg px-4 font-bold text-white/90">
          <Ban className="size-4" aria-hidden="true" />
          Sold out{soldOut ? ` (${soldOut})` : ""}
        </button>
      </div>
      {error ? (
        <p role="alert" className="bg-madder px-4 py-2 font-bold">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_17rem]">
        <section aria-label="Tickets">
          {tickets.length ? (
            <ol className="grid grid-cols-[repeat(auto-fill,minmax(15.5rem,1fr))] gap-3">
              {tickets.map(({ order: o, table, lines }) => {
                const open = lines.filter((l) => l.status === "queued" || l.status === "cooking");
                const waited = now - new Date(o.confirmed_at ?? o.placed_at).getTime();
                const slowest = Math.max(...open.map((l) => prep.get(l.item_id ?? "") ?? 10)) * 60_000;
                const tone = waited < slowest * 0.7 ? "bg-[#23733d] text-white" : waited < slowest * 1.15 ? "bg-turmeric text-[#1a1200]" : "bg-madder text-white";
                const anyQueued = open.some((l) => l.status === "queued");
                return (
                  <li key={o.id} className={`bg-slip text-ink flex flex-col overflow-hidden rounded-lg ${waited < 8000 ? "flash" : ""}`}>
                    <div className={`flex items-baseline justify-between gap-2 px-3 py-2 ${tone}`}>
                      <span className="text-lg font-bold">Table {table}</span>
                      <span className="num text-xl font-bold">{clock(waited)}</span>
                    </div>
                    <p className="text-muted flex justify-between px-3 pt-1.5 text-xs font-bold">
                      <span>KOT {o.kot}</span>
                      <span>{o.source === "qr" ? "QR order" : "Staff"}</span>
                    </p>
                    <ul className="flex-1 px-1.5 py-1">
                      {lines.filter((l) => l.status !== "cancelled").map((l) => {
                        const next = l.status === "queued" ? "cooking" : l.status === "cooking" ? "ready" : null;
                        return (
                          <li key={l.id}>
                            <button
                              type="button"
                              disabled={!next}
                              onClick={() => next && void move([l.id], next)}
                              className={`flex w-full items-start gap-2 rounded-md px-1.5 py-1.5 text-left ${next ? "hover:bg-black/5" : "opacity-45"}`}
                              aria-label={`${l.qty} ${l.name}${next ? `, mark ${next}` : ", done"}`}
                            >
                              <span className="num w-7 shrink-0 text-lg leading-6 font-bold">{l.qty}×</span>
                              <span className="min-w-0 flex-1">
                                <span className={`block text-[1.05rem] leading-6 font-bold ${next ? "" : "line-through"}`}>{l.name}</span>
                                {l.variant || l.addons.length ? <span className="text-ink-2 block text-sm">{[l.variant, ...l.addons].filter(Boolean).join(", ")}</span> : null}
                                {l.note ? <span className="text-madder block text-sm font-bold">{l.note}</span> : null}
                              </span>
                              <span className={`mt-1 shrink-0 rounded px-1.5 py-0.5 text-[0.7rem] font-bold ${l.status === "cooking" ? "bg-indigo-tint text-indigo" : l.status === "queued" ? "bg-line text-ink-2" : "bg-leaf-tint text-leaf"}`}>
                                {l.status === "cooking" ? "Cooking" : l.status === "queued" ? "New" : "Done"}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <button
                      type="button"
                      onClick={() => void move(open.filter((l) => (anyQueued ? l.status === "queued" : true)).map((l) => l.id), anyQueued ? "cooking" : "ready")}
                      className={`m-2 min-h-12 rounded-md text-base font-bold text-white ${anyQueued ? "bg-indigo" : "bg-leaf"}`}
                    >
                      {anyQueued ? "Start cooking" : "Ready at the pass"}
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="bg-pass-2 rounded-xl p-10 text-center text-lg text-white/70">All caught up. New tickets appear here the moment a table orders.</p>
          )}
        </section>
        <aside className="bg-pass-2 self-start rounded-xl p-4">
          <h2 className="font-bold">To make now</h2>
          <p className="text-xs text-white/55">Every open ticket, added up</p>
          {allDay.length ? (
            <ul className="mt-3 space-y-1.5">
              {allDay.map(([name, n]) => (
                <li key={name} className="flex justify-between gap-3">
                  <span className="truncate">{name}</span>
                  <span className="num text-turmeric shrink-0 text-lg font-bold">{n}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-white/60">Nothing waiting.</p>
          )}
        </aside>
      </div>

      {soldOpen ? <SoldOut items={data.items} onClose={() => setSoldOpen(false)} /> : null}
    </div>
  );
}

function SoldOut({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const list = items.filter((m) => m.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Sheet title="Sold out today" onClose={onClose}>
      <p className="text-ink-2 text-sm">Switch a dish off and it greys out on every guest&apos;s phone at once.</p>
      <div className="relative mt-3">
        <Search className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden="true" />
        <input type="search" className="field !pl-9" placeholder="Find a dish" aria-label="Find a dish" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="divide-line mt-2 divide-y">
        {list.map((m) => (
          <li key={m.id} className="flex min-h-12 items-center justify-between gap-3">
            <span className={m.available ? "" : "text-madder font-bold"}>{m.name}</span>
            <button type="button" className={`btn !min-h-9 text-sm ${m.available ? "btn-line" : "btn-primary"}`} onClick={() => void call("/api/staff", { type: "available", itemId: m.id, available: !m.available })}>
              {m.available ? "Sold out" : "Back on"}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
