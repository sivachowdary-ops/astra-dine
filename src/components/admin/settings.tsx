"use client";

import { useState } from "react";
import { ImagePlus, Sparkles } from "lucide-react";
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
    tagline: r.tagline ?? "",
    offer_title: r.offer_title ?? "",
    offer_text: r.offer_text ?? "",
  });
  const [cover, setCover] = useState(r.cover_url);
  const [logo, setLogo] = useState(r.logo_url);
  const upload = async (brand: "cover" | "logo", file: File | undefined) => {
    if (!file) return;
    const body = new FormData();
    body.set("file", file);
    body.set("brand", brand);
    const res = await fetch("/api/admin/photo", { method: "POST", body });
    const out = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !out.url) return setMsg(out.error ?? "Upload failed. Try again.");
    if (brand === "cover") setCover(out.url);
    else setLogo(out.url);
    setMsg(brand === "cover" ? "Cover photo updated. Guests see it now." : "Logo updated. Guests see it now.");
  };
  const [msg, setMsg] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const text = (k: "name" | "place" | "gstin" | "upi_vpa" | "upi_name" | "reward_text" | "google_review_url" | "tagline" | "offer_title" | "offer_text", label: string, hint?: string, max?: number) => (
    <div className="mt-3">
      <label className="label" htmlFor={k}>
        {label}
      </label>
      <input id={k} className="field" maxLength={max} value={f[k]} onChange={(e) => set(k, e.target.value)} />
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
        <section className="bg-card border-line grid gap-5 rounded-xl border p-4 lg:col-span-2 lg:grid-cols-[1fr_20rem]">
          <div>
            <h2 className="font-bold">How guests see you</h2>
            <p className="text-ink-2 text-sm">The top of the menu on every guest&apos;s phone.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <label className="btn btn-line cursor-pointer">
                <ImagePlus className="size-4" aria-hidden="true" />
                {cover ? "Change cover photo" : "Add a cover photo"}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void upload("cover", e.target.files?.[0])} />
              </label>
              <label className="btn btn-line cursor-pointer">
                <ImagePlus className="size-4" aria-hidden="true" />
                {logo ? "Change logo" : "Add your logo"}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void upload("logo", e.target.files?.[0])} />
              </label>
            </div>
            <p className="text-muted mt-1 text-xs">A wide photo of your best dishes or your dining room works best. JPG, PNG or WebP, under 3 MB.</p>
            {text("tagline", "Tagline", "One short line under your name.", 60)}
            <div className="grid gap-x-3 sm:grid-cols-[12rem_1fr]">
              {text("offer_title", "Offer heading", "Leave both empty to hide the offer.", 40)}
              {text("offer_text", "Offer", undefined, 160)}
            </div>
          </div>
          <Preview name={f.name} tagline={f.tagline} cover={cover} logo={logo} offerTitle={f.offer_title} offerText={f.offer_text} />
        </section>
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

function Preview({ name, tagline, cover, logo, offerTitle, offerText }: { name: string; tagline: string; cover: string | null; logo: string | null; offerTitle: string; offerText: string }) {
  return (
    <figure aria-label="Preview of the guest's phone" className="border-ink mx-auto w-full max-w-[17rem] overflow-hidden rounded-[1.6rem] border-[6px] bg-[#f5f5f2] shadow-lg">
      <div className="relative h-36 bg-[#2b1a12]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {cover ? <img src={cover} alt="" className="absolute inset-0 size-full object-cover" /> : null}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgb(20_12_8/0.85))]" />
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-2 p-2.5 text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo ? <img src={logo} alt="" className="size-10 rounded-full border-2 border-white bg-white" /> : null}
          <div className="min-w-0">
            <p className="dish truncate text-lg leading-none">{name || "Your restaurant"}</p>
            {tagline ? <p className="truncate text-[0.7rem] text-white/85">{tagline}</p> : null}
          </div>
        </div>
      </div>
      <div className="p-2.5">
        {offerTitle || offerText ? (
          <div className="flex gap-2 rounded-xl bg-[linear-gradient(120deg,#7a1f12,#a3301f_55%,#c2521f)] p-2.5 text-white">
            <Sparkles className="text-turmeric size-4 shrink-0" aria-hidden="true" />
            <div className="text-[0.7rem] leading-snug">
              {offerTitle ? <p className="text-white/75">{offerTitle}</p> : null}
              <p className="font-bold">{offerText}</p>
            </div>
          </div>
        ) : (
          <p className="text-muted text-center text-[0.7rem]">No offer showing</p>
        )}
        <div className="bg-line mt-2 h-2 w-2/3 rounded-full" />
        <div className="bg-line mt-1.5 h-2 w-1/2 rounded-full" />
      </div>
      <figcaption className="sr-only">Updates as you type</figcaption>
    </figure>
  );
}
