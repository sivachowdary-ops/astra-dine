"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { call } from "@/lib/live";
import type { Restaurant } from "@/lib/types";
import { H, Notice } from "./admin-app";

export function SettingsSection({ restaurant: r }: { restaurant: Restaurant }) {
  const router = useRouter();
  const [f, setF] = useState({
    name: r.name,
    place: r.place ?? "",
    gstin: r.gstin ?? "",
    gst_pct: Number(r.gst_pct),
    upi_vpa: r.upi_vpa ?? "",
    upi_name: r.upi_name ?? "",
    confirm_first_order: r.confirm_first_order,
    pay_at_table: r.pay_at_table,
    stamps_for_reward: r.stamps_for_reward,
    stamp_min_bill: r.stamp_min_bill,
    reward_text: r.reward_text,
    reward_value: r.reward_value,
    google_review_url: r.google_review_url ?? "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const text = (k: "name" | "place" | "gstin" | "upi_vpa" | "upi_name" | "reward_text" | "google_review_url", label: string, hint?: string) => (
    <div className="mt-3">
      <label className="label" htmlFor={k}>
        {label}
      </label>
      <input id={k} className="field" value={f[k]} onChange={(e) => set(k, e.target.value)} />
      {hint ? <p className="text-muted mt-1 text-xs">{hint}</p> : null}
    </div>
  );
  const num = (k: "gst_pct" | "stamps_for_reward" | "stamp_min_bill" | "reward_value", label: string) => (
    <div className="mt-3">
      <label className="label" htmlFor={k}>
        {label}
      </label>
      <input id={k} className="field" inputMode="decimal" value={f[k]} onChange={(e) => set(k, Number(e.target.value.replace(/[^\d.]/g, "")) || 0)} />
    </div>
  );
  const toggle = (k: "confirm_first_order" | "pay_at_table", label: string, hint: string) => (
    <label className="border-line mt-3 flex items-start gap-3 rounded-lg border p-3">
      <input type="checkbox" className="accent-indigo mt-1 size-4" checked={f[k]} onChange={(e) => set(k, e.target.checked)} />
      <span>
        <span className="block font-bold">{label}</span>
        <span className="text-ink-2 text-sm">{hint}</span>
      </span>
    </label>
  );
  return (
    <>
      <H sub="Applies at once to the tables, kitchen and cashier.">Settings</H>
      <Notice text={msg} onDone={() => setMsg(null)} />
      <form
        className="grid max-w-4xl gap-6 lg:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await call("/api/admin", { type: "settings", ...f });
          setMsg(error ?? "Settings saved.");
          if (!error) router.refresh();
        }}
      >
        <section className="bg-card border-line rounded-xl border p-4">
          <h2 className="font-bold">Restaurant</h2>
          {text("name", "Name")}
          {text("place", "Area and city")}
          {text("gstin", "GSTIN", "Printed on bills.")}
          {num("gst_pct", "GST on food (%)")}
          <h2 className="mt-6 font-bold">Payments at the table</h2>
          {text("upi_vpa", "Your UPI ID", "Guests pay this UPI ID from their phone, e.g. kaaramkitchen@okicici. The cashier confirms each payment arrived.")}
          {text("upi_name", "Name shown in the UPI app")}
          {toggle("pay_at_table", "Guests can pay from their phone", "Turn off to have everyone pay at the counter.")}
        </section>
        <section className="bg-card border-line rounded-xl border p-4">
          <h2 className="font-bold">Orders</h2>
          {toggle("confirm_first_order", "Staff confirm a table's first QR order", "Stops pranks and orders from outside. After the first one, the table's orders go straight to the kitchen.")}
          <h2 className="mt-6 font-bold">Loyalty card</h2>
          {num("stamps_for_reward", "Stamps for a reward")}
          {num("stamp_min_bill", "Smallest bill that earns a stamp (₹)")}
          {text("reward_text", "Reward")}
          {num("reward_value", "Reward value off the bill (₹)")}
          <h2 className="mt-6 font-bold">Google reviews</h2>
          {text("google_review_url", "Your Google review link", "From your Google Business Profile, 'Ask for reviews'. Happy guests see it after paying, with no reward attached.")}
        </section>
        <button type="submit" className="btn btn-primary lg:col-span-2 lg:justify-self-start">
          Save settings
        </button>
      </form>
    </>
  );
}
