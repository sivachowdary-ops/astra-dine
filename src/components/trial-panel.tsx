"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ChefHat, ExternalLink, QrCode, ReceiptText, Smartphone, X } from "lucide-react";
import { browserClient } from "@/lib/supabase/browser";
import type { Restaurant } from "@/lib/types";

/** Keeps a trial copy busy (pretend guests) while any of its screens is open. */
export function useTrialPulse(r: Pick<Restaurant, "expires_at">) {
  useEffect(() => {
    if (!r.expires_at) return;
    const beat = () => !document.hidden && void fetch("/api/trial/pulse", { method: "POST" }).catch(() => {});
    const first = window.setTimeout(beat, 3000);
    const t = window.setInterval(beat, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(t);
    };
  }, [r.expires_at]);
}

const until = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", hour: "numeric", minute: "2-digit" });

type Screen = { id: "kitchen" | "cashier" | "table"; title: string; line: string; here: string; icon: typeof ChefHat };

/** The visitor's own copy: open every screen here, or on another device with a QR code. */
export function TrialPanel({ restaurant: r }: { restaurant: Restaurant }) {
  const [table, setTable] = useState<{ label: string; token: string } | null>(null);
  const [qr, setQr] = useState<{ title: string; url: string; img: string; note: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useTrialPulse(r);

  useEffect(() => {
    if (!r.expires_at) return;
    void browserClient()
      .from("dining_tables")
      .select("label, qr_token")
      .eq("restaurant_id", r.id)
      .eq("label", "5")
      .maybeSingle()
      .then(({ data }: { data: { label: string; qr_token: string } | null }) => data && setTable({ label: data.label, token: data.qr_token }));
  }, [r.id, r.expires_at]);
  useEffect(() => {
    if (!qr) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setQr(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [qr]);
  if (!r.expires_at) return null;

  const screens: Screen[] = [
    { id: "kitchen", title: "Kitchen screen", line: "Tickets arrive here the moment a table orders. Tap Start cooking, then Ready.", here: "/kitchen", icon: ChefHat },
    { id: "cashier", title: "Cashier", line: "The floor plan: confirm QR orders, answer calls, take payment, close tables.", here: "/pos", icon: ReceiptText },
    { id: "table", title: `Guest at table ${table?.label ?? "5"}`, line: "Scan as a guest would: order from the menu, call staff, pay, rate the meal.", here: table ? `/order/${table.token}` : "#", icon: Smartphone },
  ];

  const showQr = async (s: Screen) => {
    setBusy(s.id);
    setError(null);
    try {
      let url: string;
      if (s.id === "table") url = new URL(s.here, window.location.origin).toString();
      else {
        const res = await fetch("/api/trial/device", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: s.id }) });
        const out = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!res.ok || !out.url) throw new Error(out.error ?? "Couldn't make the link.");
        url = out.url;
      }
      setQr({
        title: s.title,
        url,
        img: await QRCode.toDataURL(url, { margin: 1, width: 260, color: { dark: "#1d1a17", light: "#ffffff" } }),
        note: s.id === "table" ? "Any phone can scan this, as many times as you like." : "Opens signed in on a tablet or phone. Works once, for 2 hours.",
      });
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(null);
  };

  return (
    <section aria-labelledby="trial-h" className="border-line mb-8 overflow-hidden rounded-xl border bg-white">
      <div className="bg-turmeric-tint flex flex-wrap items-baseline justify-between gap-2 px-5 py-3">
        <h2 id="trial-h" className="font-bold">
          Your private copy of {r.name}: every screen is yours to try
        </h2>
        <p className="text-ink-2 text-sm">Deleted {until(r.expires_at)}. Pretend guests keep ordering.</p>
      </div>
      <ul className="divide-line grid divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
        {screens.map((s) => (
          <li key={s.id} className="flex flex-col p-5">
            <s.icon className="text-indigo size-6" aria-hidden="true" />
            <h3 className="dish mt-3 text-xl">{s.title}</h3>
            <p className="text-ink-2 mt-1 flex-1 text-sm">{s.line}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={s.here} target="_blank" rel="noopener" className="btn btn-primary !min-h-10 text-sm">
                <ExternalLink className="size-4" aria-hidden="true" />
                Open here
              </a>
              <button type="button" className="btn btn-line !min-h-10 text-sm" onClick={() => void showQr(s)} disabled={busy !== null}>
                <QrCode className="size-4" aria-hidden="true" />
                {busy === s.id ? "Making…" : "On another device"}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-madder px-5 pb-4 text-sm font-bold">
          {error}
        </p>
      ) : null}
      {qr ? (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={`Open the ${qr.title} on another device`}>
          <button type="button" aria-label="Close" className="absolute inset-0 bg-[rgb(29_26_23/0.5)]" onClick={() => setQr(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
            <button type="button" className="btn btn-quiet absolute top-2 right-2 !px-2" onClick={() => setQr(null)} aria-label="Close">
              <X className="size-5" aria-hidden="true" />
            </button>
            <h3 className="dish text-2xl">{qr.title}</h3>
            <p className="text-ink-2 mt-1 text-sm">{qr.note}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.img} alt={`QR code that opens the ${qr.title}`} className="mx-auto mt-4 size-60" />
            <p className="text-muted mt-3 text-xs break-all">{qr.url}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
