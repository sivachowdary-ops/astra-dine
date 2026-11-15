import type { Line, MenuItem, Payment, Restaurant, Session } from "./types";

/** Restaurant rules shared by the server and every screen, so they always agree. */

export const BILLABLE: Line["status"][] = ["queued", "cooking", "ready", "served"];

export function unitPrice(item: Pick<MenuItem, "price" | "variants" | "addons">, variantId?: string | null, addonIds: string[] = []) {
  const variant = item.variants.find((v) => v.id === variantId);
  const base = variant ? variant.price : item.price;
  return base + item.addons.filter((a) => addonIds.includes(a.id)).reduce((s, a) => s + a.price, 0);
}

export function billFor(r: Pick<Restaurant, "gst_pct">, session: Pick<Session, "discount" | "discount_label">, lines: Line[], payments: Payment[]) {
  const billable = lines.filter((l) => BILLABLE.includes(l.status));
  const subtotal = billable.reduce((s, l) => s + l.unit_price * l.qty, 0);
  const discount = Math.min(subtotal, session.discount ?? 0);
  const taxable = subtotal - discount;
  const gst = Math.round((taxable * Number(r.gst_pct)) / 100);
  const total = taxable + gst;
  const confirmed = payments.filter((p) => p.status === "confirmed").reduce((s, p) => s + p.amount, 0);
  const claimed = payments.filter((p) => p.status === "claimed").reduce((s, p) => s + p.amount, 0);
  return {
    lines: billable,
    subtotal,
    discount,
    taxable,
    cgst: gst / 2,
    sgst: gst / 2,
    gst,
    total,
    paid: confirmed,
    claimed,
    due: Math.max(0, total - confirmed - claimed),
  };
}
export type Bill = ReturnType<typeof billFor>;

/** A UPI payment link that opens GPay, PhonePe, Paytm or any UPI app with the amount filled in. */
export function upiLink(r: Pick<Restaurant, "upi_vpa" | "upi_name" | "name">, amount: number, note: string) {
  if (!r.upi_vpa) return null;
  const q = new URLSearchParams({ pa: r.upi_vpa, pn: r.upi_name || r.name, am: amount.toFixed(2), cu: "INR", tn: note });
  return `upi://pay?${q.toString()}`;
}

export const inr = (n: number) => `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(n))}`;

export function minsSince(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return 0;
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
}
export function ago(iso: string | null | undefined, now = Date.now()) {
  const m = minsSince(iso, now);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}
export function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const stationNames: Record<string, string> = { kitchen: "Kitchen", tandoor: "Tandoor", bar: "Drinks", desserts: "Desserts" };

/** Staff sign in with a username at their restaurant; this is the address Supabase stores. */
export const staffEmail = (slug: string, username: string) => `${username.toLowerCase()}@${slug}.staff.astradine.app`;
