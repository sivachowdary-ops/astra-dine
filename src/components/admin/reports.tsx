"use client";

import { useEffect, useState } from "react";
import { inr } from "@/lib/rules";
import { browserClient } from "@/lib/supabase/browser";
import type { Restaurant } from "@/lib/types";
import { Figure, H } from "./admin-app";

type Day = { day: string; sales: number; bills: number; guests: number; qr_bills: number };
type Hour = { dow: number; hour: number; bills: number };
type ItemRow = { name: string; qty: number; revenue: number };

export function ReportsSection({ restaurant: r }: { restaurant: Restaurant }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<{ days: Day[]; hours: Hour[]; items: ItemRow[] } | null>(null);
  useEffect(() => {
    let alive = true;
    const db = browserClient();
    Promise.all([db.rpc("report_days", { r: r.id, days }), db.rpc("report_hours", { r: r.id, days }), db.rpc("report_items", { r: r.id, days })]).then(([d, h, i]) => {
      if (alive) setData({ days: (d.data ?? []) as Day[], hours: (h.data ?? []) as Hour[], items: (i.data ?? []) as ItemRow[] });
    });
    return () => {
      alive = false;
    };
  }, [r.id, days]);

  const sum = (k: keyof Omit<Day, "day">) => (data?.days ?? []).reduce((s, d) => s + Number(d[k]), 0);
  const sales = sum("sales");
  const bills = sum("bills");
  const max = Math.max(1, ...(data?.days ?? []).map((d) => Number(d.sales)));
  const hours = Array.from({ length: 17 }, (_, i) => i + 7);
  const heat = (dow: number, hour: number) => data?.hours.find((x) => x.dow === dow && x.hour === hour)?.bills ?? 0;
  const heatMax = Math.max(1, ...(data?.hours ?? []).map((x) => x.bills));
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <>
      <H
        sub="From paid bills."
        action={
          <div role="tablist" aria-label="Period" className="flex gap-1">
            {[7, 30, 90].map((d) => (
              <button key={d} role="tab" type="button" aria-selected={days === d} onClick={() => setDays(d)} className={`btn !min-h-10 text-sm ${days === d ? "btn-primary" : "btn-line"}`}>
                {d} days
              </button>
            ))}
          </div>
        }
      >
        Reports
      </H>
      {!data ? (
        <p className="text-muted">Working it out…</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Figure k="Sales" v={inr(sales)} sub={`${bills.toLocaleString("en-IN")} bills`} />
            <Figure k="Average bill" v={inr(bills ? sales / bills : 0)} sub={`${sum("guests").toLocaleString("en-IN")} guests`} />
            <Figure k="Ordered by QR" v={bills ? `${Math.round((sum("qr_bills") / bills) * 100)}%` : "–"} sub="of paid tables" />
            <Figure k="Per day" v={inr(data.days.length ? sales / data.days.length : 0)} sub={`over ${data.days.length} trading days`} />
          </dl>

          <section aria-labelledby="daily" className="bg-card border-line mt-6 rounded-xl border p-4">
            <h2 id="daily" className="font-bold">
              Sales by day
            </h2>
            {data.days.length ? (
              <>
                <div className="mt-3 flex h-44 items-end gap-[3px]" role="img" aria-label={`Daily sales for the last ${days} days`}>
                  {data.days.map((d) => {
                    const dow = new Date(d.day).getDay();
                    return <div key={d.day} title={`${d.day}: ${inr(Number(d.sales))}`} className={`flex-1 rounded-t-sm ${dow === 0 || dow === 6 ? "bg-turmeric" : "bg-indigo"}`} style={{ height: `${(Number(d.sales) / max) * 100}%` }} />;
                  })}
                </div>
                <p className="text-muted mt-2 text-xs">Turmeric bars are weekends.</p>
              </>
            ) : (
              <p className="text-muted mt-2 text-sm">No paid bills in this period yet.</p>
            )}
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <section aria-labelledby="heat" className="bg-card border-line overflow-x-auto rounded-xl border p-4">
              <h2 id="heat" className="font-bold">
                When tables come in
              </h2>
              <p className="text-muted text-sm">Bills by hour seated. Staff the floor and the kitchen to match.</p>
              <table className="mt-3 border-separate border-spacing-[3px] text-xs">
                <thead>
                  <tr>
                    <th scope="col" />
                    {hours.map((h) => (
                      <th key={h} scope="col" className="text-muted font-normal">
                        {h > 12 ? h - 12 : h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5, 6, 0].map((dow) => (
                    <tr key={dow}>
                      <th scope="row" className="text-muted pr-1 text-left font-normal">
                        {dayNames[dow]}
                      </th>
                      {hours.map((h) => (
                        <td key={h} title={`${dayNames[dow]} ${h}:00, ${heat(dow, h)} bills`} className="size-6 rounded-sm" style={{ background: `rgb(39 50 111 / ${0.05 + (heat(dow, h) / heatMax) * 0.95})` }} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section aria-labelledby="dishes" className="bg-card border-line rounded-xl border p-4">
              <h2 id="dishes" className="font-bold">
                Dishes
              </h2>
              <ol className="mt-2 space-y-1.5 text-sm">
                {data.items.slice(0, 10).map((s) => (
                  <li key={s.name} className="flex justify-between gap-3">
                    <span>{s.name}</span>
                    <span className="num font-bold">{Number(s.qty).toLocaleString("en-IN")}</span>
                  </li>
                ))}
              </ol>
              {data.items.length > 12 ? (
                <>
                  <h3 className="text-madder mt-4 text-sm font-bold">Slowest sellers</h3>
                  <ol className="mt-1 space-y-1.5 text-sm">
                    {data.items.slice(-4).map((s) => (
                      <li key={s.name} className="flex justify-between gap-3">
                        <span>{s.name}</span>
                        <span className="num">{Number(s.qty)}</span>
                      </li>
                    ))}
                  </ol>
                </>
              ) : null}
            </section>
          </div>
        </>
      )}
    </>
  );
}
