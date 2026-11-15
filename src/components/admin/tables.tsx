"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Printer, RefreshCw, Trash2 } from "lucide-react";
import { call, useLive } from "@/lib/live";
import { browserClient } from "@/lib/supabase/browser";
import type { DiningTable, Restaurant } from "@/lib/types";
import { H, Notice } from "./admin-app";

/** The address customers' phones open. On a laptop it uses the Wi-Fi address so phones can reach it. */
export function usePublicBase() {
  const [base, setBase] = useState("");
  useEffect(() => {
    const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    fetch("/api/host")
      .then((r) => r.json() as Promise<{ lan: string | null }>)
      .then((d) => setBase(local && d.lan ? d.lan : location.origin))
      .catch(() => setBase(location.origin));
  }, []);
  return base;
}

export function TablesSection({ restaurant: r }: { restaurant: Restaurant }) {
  const { data, reload } = useLive(r.id, ["dining_tables"], async () => {
    const { data: t } = await browserClient().from("dining_tables").select("*").eq("restaurant_id", r.id).order("sort");
    return (t ?? []) as DiningTable[];
  });
  const base = usePublicBase();
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [add, setAdd] = useState({ from: 1, count: 10, area: "Main hall", seats: 4 });

  useEffect(() => {
    if (!base || !data) return;
    Promise.all(data.map(async (t) => [t.id, await QRCode.toDataURL(`${base}/order/${t.qr_token}`, { margin: 1, width: 300, color: { dark: "#1d1a17" } })] as const)).then((pairs) =>
      setCodes(Object.fromEntries(pairs)),
    );
  }, [base, data]);

  const admin = async (body: object, ok?: string) => {
    const { error } = await call("/api/admin", body);
    setMsg(error ?? ok ?? null);
    reload();
  };
  if (!data) return <p className="text-muted">Loading tables…</p>;
  const next = data.reduce((m, t) => Math.max(m, Number(t.label) || 0), 0) + 1;

  return (
    <>
      <H
        sub={`Each table has its own QR code. Print them and put one on every table. Customers scan, order and pay. Codes point to ${base || "…"}`}
        action={
          data.length ? (
            <button type="button" className="btn btn-line print:hidden" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden="true" />
              Print all
            </button>
          ) : null
        }
      >
        Tables and QR codes
      </H>
      <Notice text={msg} onDone={() => setMsg(null)} />
      <form
        className="bg-card border-line mb-6 grid max-w-3xl gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_1fr_1.4fr_1fr_auto] sm:items-end print:hidden"
        onSubmit={(e) => {
          e.preventDefault();
          void admin({ type: "addTables", ...add, from: add.from || next }, `Tables added.`);
        }}
      >
        <div>
          <label className="label" htmlFor="t-from">
            Starting number
          </label>
          <input id="t-from" className="field" inputMode="numeric" value={add.from === 1 && data.length ? next : add.from} onChange={(e) => setAdd({ ...add, from: Number(e.target.value) || 1 })} />
        </div>
        <div>
          <label className="label" htmlFor="t-count">
            How many
          </label>
          <input id="t-count" className="field" inputMode="numeric" value={add.count} onChange={(e) => setAdd({ ...add, count: Number(e.target.value) || 1 })} />
        </div>
        <div>
          <label className="label" htmlFor="t-area">
            Area
          </label>
          <input id="t-area" className="field" value={add.area} onChange={(e) => setAdd({ ...add, area: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="t-seats">
            Seats each
          </label>
          <input id="t-seats" className="field" inputMode="numeric" value={add.seats} onChange={(e) => setAdd({ ...add, seats: Number(e.target.value) || 1 })} />
        </div>
        <button type="submit" className="btn btn-primary">
          Add tables
        </button>
      </form>

      {data.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 print:grid-cols-3">
          {data.map((t) => (
            <li key={t.id} className="bg-card border-line flex flex-col items-center rounded-xl border p-3 text-center break-inside-avoid">
              <span className="dish text-lg">{r.name}</span>
              {codes[t.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={codes[t.id]} alt={`QR code for table ${t.label}`} width={150} height={150} className="mt-1" />
              ) : (
                <span className="bg-ground mt-1 block size-[150px]" />
              )}
              <span className="num mt-1 text-2xl font-bold">Table {t.label}</span>
              <span className="text-muted text-xs">Scan to see the menu, order and pay</span>
              <span className="text-muted mt-1 text-xs print:hidden">
                {t.area}, {t.seats} seats
              </span>
              <div className="mt-2 flex gap-1 print:hidden">
                <a href={`${base}/order/${t.qr_token}`} target="_blank" rel="noopener" className="btn btn-quiet !min-h-9 text-sm">
                  Open
                </a>
                <button type="button" className="btn btn-quiet !min-h-9 !px-2.5" title="New QR code (the old one stops working)" aria-label={`New QR code for table ${t.label}`} onClick={() => window.confirm(`Make a new QR code for table ${t.label}? The printed one will stop working.`) && void admin({ type: "newQr", id: t.id }, "New QR code made. Print it.")}>
                  <RefreshCw className="size-4" aria-hidden="true" />
                </button>
                <button type="button" className="btn btn-quiet text-madder !min-h-9 !px-2.5" aria-label={`Delete table ${t.label}`} onClick={() => window.confirm(`Delete table ${t.label}?`) && void admin({ type: "deleteTable", id: t.id }, "Table deleted.")}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-2">No tables yet. Add them above, then print the QR codes.</p>
      )}
    </>
  );
}
