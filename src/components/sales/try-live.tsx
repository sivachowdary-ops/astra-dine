"use client";

import { useEffect, useState } from "react";
import { ChefHat, CircleCheck, Clock3, ReceiptText } from "lucide-react";
import { inr } from "@/lib/rules";
import type { TryLive } from "@/lib/server/showcase";

const tone: Record<string, string> = {
  pending: "bg-turmeric text-[#241800]",
  queued: "bg-white/15 text-white",
  cooking: "bg-[#5b6bd6] text-white",
  ready: "bg-[#3f9a57] text-white",
  served: "bg-white/8 text-white/55",
  cancelled: "bg-white/8 text-white/40 line-through",
};
const word: Record<string, string> = { pending: "Waiting for cashier", queued: "New", cooking: "Cooking", ready: "Ready", served: "Served", cancelled: "Rejected" };
const tableWord: Record<string, string> = { free: "Free", seated: "Ordering", bill: "Bill asked", paid: "Paid" };

/** The try-it tables as the kitchen and cashier see them, refreshed every few seconds. */
export function TryLivePanel() {
  const [data, setData] = useState<TryLive | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const res = await fetch("/api/showcase/live", { cache: "no-store" });
        if (res.ok && !stop) setData((await res.json()) as TryLive);
      } catch {
        // Try again on the next tick.
      }
      if (!stop) setNow(Date.now());
    };
    void load();
    const t = window.setInterval(load, 3000);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, []);
  const tickets = (data?.tables ?? []).flatMap((t) => t.tickets.filter((k) => k.lines.some((l) => l.status !== "served" && l.status !== "cancelled")).map((k) => ({ ...k, table: t.label })));
  const mins = (iso: string | null) => (iso && now ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000)) : 0);

  return (
    <div className="bg-pass overflow-hidden rounded-2xl text-white shadow-[0_30px_60px_-30px_rgb(19_20_22/0.7)] ring-1 ring-white/10">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-bold">
          <span className="relative flex size-2.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-[#3f9a57] motion-reduce:hidden" />
            <span className="relative size-2.5 rounded-full bg-[#3f9a57]" />
          </span>
          Live from {data?.restaurant ?? "the demo restaurant"}
        </p>
        <p className="text-xs text-white/55">Updates every 3 seconds</p>
      </div>

      <div className="p-4">
        <h3 className="flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-white/55 uppercase">
          <ReceiptText className="size-3.5" aria-hidden="true" /> Cashier: demo tables
        </h3>
        <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {(data?.tables ?? Array.from({ length: 6 }, (_, i) => ({ label: `T${i + 1}`, status: "free", since: null, total: 0, tickets: [] }))).map((t) => (
            <li
              key={t.label}
              className={`rounded-lg p-2.5 transition-colors ${
                t.status === "free" ? "bg-pass-2 text-white/60 ring-1 ring-white/10" : t.status === "bill" ? "bg-madder" : t.status === "paid" ? "bg-leaf" : "bg-indigo ring-1 ring-white/20"
              }`}
            >
              <p className="text-lg leading-none font-bold">{t.label}</p>
              <p className="mt-1.5 text-xs font-bold">{tableWord[t.status] ?? t.status}</p>
              <p className={`text-[0.7rem] ${t.status === "free" ? "text-white/70" : "text-white/90"}`}>{t.status === "free" ? "4 seats" : t.total ? inr(t.total) : `${mins(t.since)} min`}</p>
            </li>
          ))}
        </ul>

        <h3 className="mt-5 flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-white/55 uppercase">
          <ChefHat className="size-3.5" aria-hidden="true" /> Kitchen screen
        </h3>
        {tickets.length ? (
          <ol className="mt-2 grid gap-2 sm:grid-cols-2" aria-live="polite">
            {tickets.slice(0, 4).map((k) => (
              <li key={k.kot} className="bg-slip overflow-hidden rounded-lg text-[#1d1a17]">
                <div className={`flex items-center justify-between px-3 py-1.5 text-sm font-bold text-white ${k.confirmed ? "bg-leaf" : "bg-turmeric !text-[#241800]"}`}>
                  <span>Table {k.table}</span>
                  <span className="flex items-center gap-1 text-xs">
                    <Clock3 className="size-3" aria-hidden="true" />
                    {mins(k.at)} min
                  </span>
                </div>
                <ul className="space-y-1.5 px-3 py-2 text-sm">
                  {k.lines.map((l, i) => (
                    <li key={i} className="flex items-start justify-between gap-2">
                      <span>
                        <b>{l.qty}×</b> {l.name}
                        {l.note ? <span className="text-madder block text-xs font-bold">{l.note}</span> : null}
                      </span>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[0.7rem] font-bold ${tone[l.status] ?? ""} ${l.status === "queued" ? "!bg-[#e4e1db] !text-[#1d1a17]" : ""} ${l.status === "served" ? "!bg-[#efede8] !text-[#6a645d]" : ""}`}>
                        {word[l.status]}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        ) : (
          <div className="bg-pass-2 mt-2 flex items-center gap-3 rounded-lg p-4 text-sm text-white/70 ring-1 ring-white/10">
            <CircleCheck className="size-5 shrink-0 text-[#3f9a57]" aria-hidden="true" />
            All caught up. Scan the code and order something: your ticket appears here.
          </div>
        )}
      </div>
    </div>
  );
}
