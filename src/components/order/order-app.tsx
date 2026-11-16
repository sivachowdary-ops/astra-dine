"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BellRing, CircleCheck, ChefHat, Clock3, Flame, Gift, Minus, Plus, ReceiptText, Search, Sparkles, Star, UtensilsCrossed, X } from "lucide-react";
import { hoursLabel, inr, servingNow, unitPrice, upiLink, type Bill } from "@/lib/rules";
import type { Category, Diet, LineStatus, Option } from "@/lib/types";
import { DietMark, Sheet, Spice, StampCard, Stars } from "../bits";

type Item = {
  id: string;
  category_id: string;
  name: string;
  local_name: string | null;
  description: string | null;
  price: number;
  diet: Diet;
  spice: number;
  prep_minutes: number;
  tags: string[];
  variants: Option[];
  addons: Option[];
  serves: number | null;
  image_url: string | null;
  available: boolean;
};
type View = {
  restaurant: {
    name: string;
    place: string | null;
    upi_vpa: string | null;
    upi_name: string | null;
    pay_at_table: boolean;
    confirm_first_order: boolean;
    stamps_for_reward: number;
    stamp_min_bill: number;
    reward_text: string;
    google_review_url: string | null;
    gst_pct: number;
    cover_url: string | null;
    logo_url: string | null;
    tagline: string | null;
    offer_title: string | null;
    offer_text: string | null;
  };
  table: { label: string; area: string };
  categories: Category[];
  items: Item[];
  visit: null | {
    session: { id: string; status: "seated" | "bill" | "paid" | "closed"; bill_no: number | null; discount_label: string | null; stamped: boolean; opened_at: string };
    orders: { id: string; placed_at: string; confirmed_at: string | null }[];
    lines: { id: string; order_id: string; item_id: string | null; name: string; variant: string | null; addons: string[]; qty: number; unit_price: number; note: string | null; status: LineStatus }[];
    payments: { mode: string; amount: number; status: string }[];
    bill: Bill;
    calls: { kind: string }[];
    member: { name: string | null; stamps: number; rewards_ready: number; visits: number; opt_in: boolean } | null;
    feedback: { route: string } | null;
  };
};
type CartLine = { key: string; itemId: string; variantId?: string; addonIds: string[]; qty: number; note?: string };
type Tab = "menu" | "table" | "rewards";

const lineKey = (l: Omit<CartLine, "key" | "qty">) => [l.itemId, l.variantId ?? "", [...l.addonIds].sort().join("+"), l.note ?? ""].join("|");

/** What a customer sees after scanning the table's QR code. No app, no login. */
export function OrderApp({ token }: { token: string }) {
  const [data, setData] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("menu");
  const storeKey = `dine-cart-${token}`;
  const [cart, setCart] = useState<CartLine[]>(() => {
    try {
      return typeof window === "undefined" ? [] : (JSON.parse(sessionStorage.getItem(storeKey) ?? "[]") as CartLine[]);
    } catch {
      return [];
    }
  });
  const [open, setOpen] = useState<Item | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bump, setBump] = useState(0);
  const [compact, setCompact] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const [headH, setHeadH] = useState(100);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/order/${token}`, { cache: "no-store" });
      const body = (await res.json()) as View & { error?: string };
      if (!res.ok) setError(body.error ?? "This table isn't available.");
      else {
        setData(body);
        setError(null);
      }
    } catch {
      // Keep showing the last state; the next check retries.
    }
  }, [token]);

  useEffect(() => {
    const first = window.setTimeout(() => void refresh(), 0);
    const t = window.setInterval(() => void refresh(), 4000);
    const wake = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", wake);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [refresh]);
  useEffect(() => {
    try {
      sessionStorage.setItem(storeKey, JSON.stringify(cart));
    } catch {
      // Private mode: the cart lives in memory only.
    }
  }, [cart, storeKey]);
  // A slim bar replaces the cover photo once it scrolls away.
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setCompact(!e?.isIntersecting), { rootMargin: "-80px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [data === null]); // eslint-disable-line react-hooks/exhaustive-deps
  // The category chips stick just under the header, whatever its height.
  useEffect(() => {
    const el = headRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeadH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [data === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const say = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast((t) => (t === text ? null : t)), 3800);
  };
  const send = async (body: object): Promise<string | null> => {
    setBusy(true);
    try {
      const res = await fetch(`/api/order/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      await refresh();
      return res.ok ? null : (out.error ?? "That didn't go through. Try again.");
    } catch {
      return "No connection. Check the internet and try again.";
    } finally {
      setBusy(false);
    }
  };

  if (error && !data) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-md place-items-center p-6 text-center">
        <div>
          <p className="dish text-2xl">This QR code isn&apos;t working</p>
          <p className="text-ink-2 mt-2">{error}</p>
        </div>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="mx-auto min-h-dvh max-w-xl">
        <div className="bg-line h-56 animate-pulse" />
        <p className="text-muted p-6">Opening the menu…</p>
      </main>
    );
  }

  const r = data.restaurant;
  const itemById = new Map(data.items.map((i) => [i.id, i]));
  const count = cart.reduce((s, l) => s + l.qty, 0);
  const total = cart.reduce((s, l) => {
    const item = itemById.get(l.itemId);
    return item ? s + unitPrice(item, l.variantId, l.addonIds) * l.qty : s;
  }, 0);
  const v = data.visit;
  const active = v ? v.lines.filter((l) => l.status !== "served" && l.status !== "cancelled").length : 0;
  const add = (line: Omit<CartLine, "key">) => {
    const key = lineKey(line);
    setCart((c) => (c.some((x) => x.key === key) ? c.map((x) => (x.key === key ? { ...x, qty: x.qty + line.qty } : x)) : [...c, { ...line, key }]));
    setBump((b) => b + 1);
  };
  const removeOne = (itemId: string) =>
    setCart((c) => {
      const i = c.findLastIndex((x) => x.itemId === itemId);
      if (i < 0) return c;
      const next = [...c];
      const line = next[i]!;
      if (line.qty > 1) next[i] = { ...line, qty: line.qty - 1 };
      else next.splice(i, 1);
      return next;
    });

  const placeOrder = async () => {
    const err = await send({ type: "order", lines: cart.map(({ itemId, variantId, addonIds, qty, note }) => ({ itemId, variantId: variantId ?? null, addonIds, qty, note: note ?? null })) });
    if (err) return say(err);
    setCart([]);
    setCartOpen(false);
    setTab("table");
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="bg-ground mx-auto min-h-dvh max-w-xl pb-28">
      {/* Cover */}
      <div ref={heroRef} className="relative h-60 overflow-hidden bg-[#2b1a12] sm:h-72">
        {r.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.cover_url} alt="" className="absolute inset-0 size-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(20_12_8/0.15)_0%,rgb(20_12_8/0.25)_45%,rgb(20_12_8/0.88)_100%)]" />
        <button type="button" onClick={() => setCallOpen(true)} className="absolute top-3 right-3 flex min-h-11 items-center gap-2 rounded-full bg-white/92 px-4 text-sm font-bold text-[#1d1a17] shadow-md backdrop-blur">
          <BellRing className="size-4" aria-hidden="true" />
          Call staff
        </button>
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 px-4 pb-4">
          {r.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.logo_url} alt="" className="size-16 shrink-0 rounded-full border-[3px] border-white bg-white shadow-lg" />
          ) : null}
          <div className="min-w-0 text-white">
            <h1 className="dish text-[1.85rem] leading-none drop-shadow">{r.name}</h1>
            {r.tagline ? <p className="mt-1 text-sm text-white/85">{r.tagline}</p> : null}
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/18 px-2.5 py-1 text-xs font-bold backdrop-blur">
              <UtensilsCrossed className="size-3.5" aria-hidden="true" />
              Table {data.table.label}, {data.table.area.toLowerCase()}
            </p>
          </div>
        </div>
      </div>

      {/* Slim bar and tabs, sticky */}
      <div ref={headRef} className="bg-ground/95 sticky top-0 z-30 backdrop-blur">
        {compact ? (
          <div className="flex items-center justify-between gap-3 px-4 pt-2">
            <p className="min-w-0 truncate text-sm">
              <span className="dish text-base">{r.name}</span> <span className="text-muted">Table {data.table.label}</span>
            </p>
            <button type="button" className="btn btn-line !min-h-9 shrink-0 !px-3 text-sm" onClick={() => setCallOpen(true)}>
              <BellRing className="size-4" aria-hidden="true" />
              Call
            </button>
          </div>
        ) : null}
        {v?.calls.length ? (
          <p className="bg-turmeric-tint text-turmeric-ink mx-4 mt-2 rounded-lg px-3 py-1.5 text-sm font-bold" role="status">
            Staff have been called and are on their way.
          </p>
        ) : null}
        <nav aria-label="Sections" className="mx-4 mt-2 grid grid-cols-3 gap-1 rounded-full bg-[#e9e6e0] p-1">
          {(
            [
              ["menu", "Menu"],
              ["table", "Your table"],
              ["rewards", "Rewards"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
              className={`relative min-h-10 rounded-full text-[0.92rem] transition-colors ${tab === id ? "bg-white font-bold text-[#1d1a17] shadow-sm" : "text-ink-2"}`}
            >
              {label}
              {id === "table" && active ? <span className="bg-madder ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold text-white">{active}</span> : null}
            </button>
          ))}
        </nav>
        <div className="h-2" />
      </div>

      {tab === "menu" ? <MenuView data={data} top={headH} cart={cart} onOpen={setOpen} onQuickAdd={(item) => add({ itemId: item.id, addonIds: [], qty: 1 })} onRemove={removeOne} onJoin={() => setJoinOpen(true)} onRewards={() => setTab("rewards")} /> : null}
      {tab === "table" ? <TableView data={data} itemById={itemById} busy={busy} send={send} say={say} onMenu={() => setTab("menu")} onJoin={() => setJoinOpen(true)} /> : null}
      {tab === "rewards" ? <RewardsView data={data} onJoin={() => setJoinOpen(true)} /> : null}

      {count > 0 && tab === "menu" ? (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-xl px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            key={bump}
            type="button"
            onClick={() => setCartOpen(true)}
            className="bump flex min-h-15 w-full items-center justify-between rounded-2xl bg-[#1d1a17] px-5 text-white shadow-[0_16px_36px_-14px_rgb(29_26_23/0.8)]"
          >
            <span className="text-left">
              <span className="block text-xs text-white/70">
                {count} {count === 1 ? "item" : "items"}
              </span>
              <span className="price block text-lg">{inr(total)}</span>
            </span>
            <span className="flex items-center gap-2 font-bold">
              View order
              <span className="bg-turmeric flex size-8 items-center justify-center rounded-full text-[#241800]">
                <ChefHat className="size-4" aria-hidden="true" />
              </span>
            </span>
          </button>
        </div>
      ) : null}

      {open ? (
        <ItemSheet
          item={open}
          onClose={() => setOpen(null)}
          onAdd={(l) => {
            add(l);
            setOpen(null);
            say(`${open.name} added`);
          }}
        />
      ) : null}

      {cartOpen ? (
        <Sheet
          title="Your order"
          onClose={() => setCartOpen(false)}
          footer={
            <>
              {r.confirm_first_order && !v?.orders.some((o) => o.confirmed_at) ? (
                <p className="text-ink-2 mb-2 text-sm">Staff confirm your table&apos;s first order in a moment, so nobody can order to your table from outside.</p>
              ) : null}
              <button type="button" className="btn btn-primary !min-h-13 w-full text-base" onClick={placeOrder} disabled={!cart.length || busy}>
                {busy ? "Sending…" : `Send to kitchen, ${inr(total)}`}
              </button>
            </>
          }
        >
          <ul className="divide-line divide-y">
            {cart.map((l) => {
              const item = itemById.get(l.itemId);
              if (!item) return null;
              const variant = item.variants.find((x) => x.id === l.variantId)?.label;
              const addons = item.addons.filter((a) => l.addonIds.includes(a.id)).map((a) => a.label);
              return (
                <li key={l.key} className="flex items-center gap-3 py-3">
                  <Thumb item={item} size="size-14" />
                  <div className="min-w-0 flex-1">
                    <p className="dish flex items-center gap-1.5 text-[1.02rem]">
                      <DietMark diet={item.diet} /> {item.name}
                    </p>
                    {variant || addons.length || l.note ? <p className="text-ink-2 truncate text-sm">{[variant, ...addons, l.note ? `"${l.note}"` : ""].filter(Boolean).join(", ")}</p> : null}
                    <p className="price mt-0.5 text-sm">{inr(unitPrice(item, l.variantId, l.addonIds) * l.qty)}</p>
                  </div>
                  <Stepper
                    qty={l.qty}
                    name={item.name}
                    onMinus={() => setCart((c) => c.flatMap((x) => (x.key !== l.key ? [x] : x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : [])))}
                    onPlus={() => setCart((c) => c.map((x) => (x.key === l.key ? { ...x, qty: x.qty + 1 } : x)))}
                  />
                </li>
              );
            })}
          </ul>
          <p className="text-muted mt-2 text-sm">GST of {r.gst_pct}% is added on the bill. No service charge.</p>
        </Sheet>
      ) : null}

      {callOpen ? (
        <Sheet title="What do you need?" onClose={() => setCallOpen(false)}>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["waiter", "A waiter"],
                ["water", "Water"],
                ["cutlery", "Cutlery"],
                ["help", "Something else"],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                className="btn btn-line !min-h-16 text-base"
                onClick={async () => {
                  const err = await send({ type: "call", kind });
                  setCallOpen(false);
                  say(err ?? "Staff have been told. Someone is on the way.");
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-muted mt-3 text-sm">For the bill, open Your table.</p>
        </Sheet>
      ) : null}

      {joinOpen ? <JoinSheet data={data} onClose={() => setJoinOpen(false)} send={send} say={say} /> : null}

      {toast ? (
        <p role="status" className="bg-ink fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-xl px-4 py-3 text-center text-sm font-bold text-white shadow-lg">
          {toast}
        </p>
      ) : null}
    </div>
  );
}

function Thumb({ item, size }: { item: Pick<Item, "image_url" | "name"> | undefined; size: string }) {
  if (!item?.image_url) {
    return (
      <span aria-hidden="true" className={`${size} bg-turmeric-tint text-turmeric-ink flex shrink-0 items-center justify-center rounded-xl`}>
        <UtensilsCrossed className="size-5" />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={item.image_url} alt="" loading="lazy" className={`${size} shrink-0 rounded-xl object-cover`} />;
}

function Stepper({ qty, name, onMinus, onPlus, dark = false }: { qty: number; name: string; onMinus: () => void; onPlus: () => void; dark?: boolean }) {
  return (
    <span className={`flex shrink-0 items-center rounded-full ${dark ? "bg-[#1d1a17] text-white" : "border-indigo bg-card text-indigo border-[1.5px]"}`}>
      <button type="button" onClick={onMinus} className="flex size-10 items-center justify-center" aria-label={`One less ${name}`}>
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <span className="price w-5 text-center" aria-label={`${qty} in order`}>
        {qty}
      </span>
      <button type="button" onClick={onPlus} className="flex size-10 items-center justify-center" aria-label={`One more ${name}`}>
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </span>
  );
}

/* ---------- Menu ---------- */

function MenuView({
  data,
  top,
  cart,
  onOpen,
  onQuickAdd,
  onRemove,
  onJoin,
  onRewards,
}: {
  data: View;
  top: number;
  cart: CartLine[];
  onOpen: (i: Item) => void;
  onQuickAdd: (i: Item) => void;
  onRemove: (id: string) => void;
  onJoin: () => void;
  onRewards: () => void;
}) {
  const [q, setQ] = useState("");
  const [veg, setVeg] = useState(false);
  const [best, setBest] = useState(false);
  const [mild, setMild] = useState(false);
  const [active, setActive] = useState(data.categories[0]?.id ?? "");
  const tabsRef = useRef<HTMLDivElement>(null);
  const r = data.restaurant;
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.items.filter(
      (m) =>
        (!veg || m.diet === "veg") &&
        (!best || m.tags.includes("bestseller")) &&
        (!mild || m.spice <= 1) &&
        (!needle || m.name.toLowerCase().includes(needle) || (m.description ?? "").toLowerCase().includes(needle) || (m.local_name ?? "").includes(needle)),
    );
  }, [data.items, q, veg, best, mild]);
  const openCat = useMemo(() => new Map(data.categories.map((c) => [c.id, servingNow(c)])), [data.categories]);
  // Sections being served now come first; breakfast at lunchtime moves to the end.
  const cats = useMemo(
    () => data.categories.filter((c) => shown.some((m) => m.category_id === c.id)).sort((a, b) => Number(openCat.get(b.id)) - Number(openCat.get(a.id))),
    [data.categories, shown, openCat],
  );
  const filtering = Boolean(q || veg || best || mild);

  useEffect(() => {
    const els = cats.map((c) => document.getElementById(`cat-${c.id}`)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id.replace("cat-", ""));
      },
      { rootMargin: `-${top + 60}px 0px -55% 0px` },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [cats, top]);
  useEffect(() => {
    // Scroll only the chip row sideways; scrollIntoView would also move the page.
    const row = tabsRef.current;
    const chip = row?.querySelector<HTMLElement>(`[data-cat="${active}"]`);
    if (row && chip) row.scrollTo({ left: chip.offsetLeft - row.clientWidth / 2 + chip.clientWidth / 2, behavior: "smooth" });
  }, [active]);

  const inCart = (id: string) => cart.filter((l) => l.itemId === id).reduce((s, l) => s + l.qty, 0);
  const loved = data.items.filter((m) => m.available && m.image_url && (m.tags.includes("bestseller") || m.tags.includes("chef")) && openCat.get(m.category_id)).slice(0, 8);
  const member = data.visit?.member;

  if (!data.items.length) return <p className="text-ink-2 px-4 py-12 text-center">The menu is being set up. Please ask the staff.</p>;

  return (
    <main>
      {!filtering && (r.offer_title || r.offer_text) ? (
        <section aria-label="Offer" className="mx-4 mt-2 flex gap-3 overflow-hidden rounded-2xl bg-[linear-gradient(120deg,#7a1f12,#a3301f_55%,#c2521f)] p-4 text-white">
          <span className="bg-turmeric flex size-11 shrink-0 items-center justify-center rounded-full text-[#241800]">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <div>
            {r.offer_title ? <p className="text-xs font-bold tracking-wide text-white/75">{r.offer_title}</p> : null}
            {r.offer_text ? <p className="mt-0.5 leading-snug font-bold">{r.offer_text}</p> : null}
          </div>
        </section>
      ) : null}

      {!filtering ? (
        member ? (
          <button type="button" onClick={onRewards} className="bg-card border-line mx-4 mt-3 flex w-[calc(100%-2rem)] items-center gap-3 rounded-2xl border p-3 text-left">
            <span className="flex -space-x-2">
              {Array.from({ length: r.stamps_for_reward }, (_, i) => (
                <span key={i} className={`size-5 rounded-full border-2 border-white ${i < member.stamps ? "bg-turmeric" : "bg-line"}`} />
              ))}
            </span>
            <span className="min-w-0 flex-1 text-sm">
              <b>{member.name ? `${member.name.split(" ")[0]}, ` : ""}{member.stamps} of {r.stamps_for_reward} stamps</b>
              <span className="text-ink-2 block">{member.rewards_ready ? `${r.reward_text} ready to use` : `${r.stamps_for_reward - member.stamps} more for a ${r.reward_text.toLowerCase()}`}</span>
            </span>
          </button>
        ) : (
          <button type="button" onClick={onJoin} className="bg-card border-line mx-4 mt-3 flex w-[calc(100%-2rem)] items-center gap-3 rounded-2xl border p-3 text-left">
            <span className="bg-turmeric-tint text-turmeric-ink flex size-10 shrink-0 items-center justify-center rounded-full">
              <Gift className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 text-sm">
              <b>Every visit earns a stamp</b>
              <span className="text-ink-2 block">
                {r.stamps_for_reward} stamps get you a {r.reward_text.toLowerCase()}. Add your number.
              </span>
            </span>
            <span className="text-indigo text-sm font-bold">Join</span>
          </button>
        )
      ) : null}

      <div className="px-4 pt-4">
        <div className="relative">
          <Search className="text-muted pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" aria-hidden="true" />
          <input type="search" className="field !h-12 !rounded-full !pl-10" placeholder={`Search ${data.items.length} dishes`} aria-label="Search dishes" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1">
          <Chip on={veg} onChange={setVeg}>
            <DietMark diet="veg" /> Veg only
          </Chip>
          <Chip on={best} onChange={setBest}>
            <Star className="size-3.5" aria-hidden="true" /> Bestsellers
          </Chip>
          <Chip on={mild} onChange={setMild}>
            <Flame className="size-3.5" aria-hidden="true" /> Not too spicy
          </Chip>
        </div>
      </div>

      {!filtering && loved.length ? (
        <section aria-labelledby="loved" className="mt-5">
          <h2 id="loved" className="dish px-4 text-[1.35rem]">
            Most loved here
          </h2>
          <ul className="mt-2 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
            {loved.map((m) => {
              const qty = inCart(m.id);
              const simple = !m.variants.length && !m.addons.length;
              return (
                <li key={m.id} className="bg-card w-[13.5rem] shrink-0 snap-start overflow-hidden rounded-2xl shadow-[0_8px_22px_-14px_rgb(29_26_23/0.45)]">
                  <button type="button" onClick={() => onOpen(m)} className="block w-full text-left" aria-label={`${m.name}, ${inr(m.price)}`}>
                    <span className="relative block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.image_url!} alt="" loading="lazy" className="h-36 w-full object-cover" />
                      {m.tags.includes("bestseller") ? <span className="bg-turmeric absolute top-2 left-2 rounded-full px-2 py-0.5 text-[0.7rem] font-bold text-[#241800]">Bestseller</span> : null}
                    </span>
                    <span className="block px-3 pt-2.5">
                      <span className="flex items-center gap-1.5">
                        <DietMark diet={m.diet} />
                        <Spice level={m.spice} />
                      </span>
                      <span className="dish mt-1 line-clamp-1 block text-[1.05rem]">{m.name}</span>
                    </span>
                  </button>
                  <div className="flex items-center justify-between px-3 pt-1 pb-3">
                    <span className="price">{m.variants.length ? `from ${inr(Math.min(...m.variants.map((x) => x.price)))}` : inr(m.price)}</span>
                    {qty && simple ? (
                      <Stepper qty={qty} name={m.name} onMinus={() => onRemove(m.id)} onPlus={() => onQuickAdd(m)} dark />
                    ) : (
                      <button type="button" onClick={() => (simple ? onQuickAdd(m) : onOpen(m))} className="flex min-h-10 items-center gap-1 rounded-full bg-[#1d1a17] px-4 text-sm font-bold text-white" aria-label={`Add ${m.name}`}>
                        <Plus className="size-4" aria-hidden="true" />
                        Add
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div ref={tabsRef} style={{ top: top - 1 }} className="bg-ground/95 sticky z-20 mt-3 flex gap-1.5 overflow-x-auto px-4 py-2 backdrop-blur" role="navigation" aria-label="Categories">
        {cats.map((c) => (
          <a
            key={c.id}
            data-cat={c.id}
            href={`#cat-${c.id}`}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm ${active === c.id ? "border-[#1d1a17] bg-[#1d1a17] font-bold text-white" : "border-line-2 text-ink-2 bg-white"}`}
          >
            {c.name} <span className={active === c.id ? "text-white/60" : "text-muted"}>{shown.filter((m) => m.category_id === c.id).length}</span>
          </a>
        ))}
      </div>

      {cats.map((c) => {
        const serving = openCat.get(c.id) ?? true;
        const hours = hoursLabel(c);
        return (
          <section key={c.id} id={`cat-${c.id}`} aria-labelledby={`h-${c.id}`} style={{ scrollMarginTop: top + 44 }} className="px-4 pt-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id={`h-${c.id}`} className="dish text-[1.6rem]">
                {c.name}
              </h2>
              {hours ? (
                <span className={`flex items-center gap-1 text-sm ${serving ? "text-muted" : "text-madder font-bold"}`}>
                  <Clock3 className="size-3.5" aria-hidden="true" />
                  {serving ? hours : `Served ${hours}`}
                </span>
              ) : c.note ? (
                <span className="text-muted text-sm">{c.note}</span>
              ) : null}
            </div>
            <ul className="mt-1">
              {shown
                .filter((m) => m.category_id === c.id)
                .map((m) => {
                  const off = !m.available || !serving;
                  const qty = inCart(m.id);
                  const simple = !m.variants.length && !m.addons.length;
                  return (
                    <li key={m.id} className={`border-line flex gap-4 border-b py-5 last:border-0 ${off ? "[&_.dish]:text-ink-2 [&_.price]:text-muted [&_span]:!text-muted" : ""}`}>
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => !off && onOpen(m)} disabled={off} aria-label={`${m.name}, ${inr(m.price)}${!m.available ? ", sold out" : !serving ? ", not served now" : ""}`}>
                        <span className="flex flex-wrap items-center gap-2">
                          <DietMark diet={m.diet} />
                          <Spice level={m.spice} />
                          {m.tags.includes("bestseller") ? (
                            <span className="text-turmeric-ink inline-flex items-center gap-0.5 text-xs font-bold">
                              <Star className="fill-turmeric text-turmeric size-3" aria-hidden="true" />
                              Bestseller
                            </span>
                          ) : null}
                          {m.tags.includes("chef") ? <span className="text-madder text-xs font-bold">Chef&apos;s pick</span> : null}
                          {m.tags.includes("new") ? <span className="text-indigo text-xs font-bold">New</span> : null}
                        </span>
                        <span className="dish mt-1.5 block text-[1.15rem] leading-tight">{m.name}</span>
                        {m.local_name ? <span className="font-te text-muted block text-[0.8rem]">{m.local_name}</span> : null}
                        <span className="price mt-1 block text-[1.02rem]">
                          {m.variants.length ? `from ${inr(Math.min(...m.variants.map((x) => x.price)))}` : inr(m.price)}
                          {m.serves ? <span className="text-muted text-sm font-normal">, serves {m.serves}</span> : null}
                        </span>
                        {m.description ? <span className="text-ink-2 mt-1.5 line-clamp-2 block text-[0.88rem] leading-snug">{m.description}</span> : null}
                      </button>
                      <div className="relative w-[7.5rem] shrink-0 pb-5">
                        {m.image_url ? (
                          <button type="button" onClick={() => !off && onOpen(m)} disabled={off} tabIndex={-1} aria-hidden="true" className="block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={m.image_url} alt="" loading="lazy" className={`h-[7.5rem] w-full rounded-2xl object-cover ${off ? "grayscale" : ""}`} />
                          </button>
                        ) : (
                          <span className="block h-12" />
                        )}
                        <div className="absolute inset-x-2 bottom-0 flex justify-center">
                          {!m.available ? (
                            <span className="bg-card text-madder rounded-full px-3 py-1.5 text-xs font-bold shadow">Sold out</span>
                          ) : !serving ? (
                            <span className="bg-card rounded-full px-3 py-1.5 text-xs font-bold shadow">Later</span>
                          ) : qty && simple ? (
                            <Stepper qty={qty} name={m.name} onMinus={() => onRemove(m.id)} onPlus={() => onQuickAdd(m)} />
                          ) : (
                            <button
                              type="button"
                              onClick={() => (simple ? onQuickAdd(m) : onOpen(m))}
                              className="border-indigo text-indigo bg-card flex min-h-10 w-full items-center justify-center gap-1 rounded-full border-[1.5px] text-sm font-bold shadow-[0_6px_14px_-8px_rgb(29_26_23/0.6)]"
                              aria-label={`Add ${m.name}`}
                            >
                              {qty ? `${qty} added` : "Add"}
                              {!simple && !qty ? <Plus className="size-3.5" aria-hidden="true" /> : null}
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </section>
        );
      })}
      {!shown.length ? <p className="text-ink-2 px-4 py-10 text-center">No dishes match. Try another word.</p> : null}
      <p className="text-muted px-4 pt-8 text-center text-xs">{r.name}{r.place ? `, ${r.place}` : ""}</p>
    </main>
  );
}

function Chip({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-bold ${on ? "border-[#1d1a17] bg-[#1d1a17] text-white" : "border-line-2 text-ink-2 bg-white"}`}>
      <input type="checkbox" className="sr-only" checked={on} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

function ItemSheet({ item, onClose, onAdd }: { item: Item; onClose: () => void; onAdd: (l: Omit<CartLine, "key">) => void }) {
  const [variantId, setVariant] = useState(item.variants.at(-1)?.id);
  const [addonIds, setAddons] = useState<string[]>([]);
  const [heat, setHeat] = useState("");
  const [note, setNote] = useState("");
  const [qty, setQty] = useState(1);
  const unit = unitPrice(item, variantId, addonIds);
  const fullNote = [heat, note.trim()].filter(Boolean).join(". ");
  return (
    <Sheet
      title={item.name}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-3">
          <Stepper qty={qty} name={item.name} onMinus={() => setQty((q) => Math.max(1, q - 1))} onPlus={() => setQty((q) => q + 1)} />
          <button type="button" className="btn btn-primary !min-h-12 flex-1 text-base" onClick={() => onAdd({ itemId: item.id, variantId, addonIds, qty, note: fullNote || undefined })}>
            Add, {inr(unit * qty)}
          </button>
        </div>
      }
    >
      {item.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.image_url} alt={item.name} className="-mx-5 mb-4 aspect-[4/3] w-[calc(100%+2.5rem)] max-w-none object-cover" />
      ) : null}
      <div className="flex items-center gap-2">
        <DietMark diet={item.diet} />
        <Spice level={item.spice} />
        {item.local_name ? <span className="font-te text-muted text-sm">{item.local_name}</span> : null}
      </div>
      {item.description ? <p className="text-ink-2 mt-2 text-[1.02rem]">{item.description}</p> : null}
      <p className="text-muted mt-1.5 flex items-center gap-1.5 text-sm">
        <Clock3 className="size-3.5" aria-hidden="true" />
        Usually ready in about {item.prep_minutes} minutes
      </p>
      {item.variants.length ? (
        <fieldset className="mt-5">
          <legend className="label">Size</legend>
          <div className="grid grid-cols-2 gap-2">
            {item.variants.map((x) => (
              <label key={x.id} className="border-line-2 has-checked:border-indigo has-checked:bg-indigo-tint flex min-h-12 items-center justify-between gap-2 rounded-xl border-[1.5px] px-3">
                <span className="flex items-center gap-2">
                  <input type="radio" name="variant" className="accent-indigo size-4" checked={variantId === x.id} onChange={() => setVariant(x.id)} />
                  {x.label}
                </span>
                <span className="price text-sm">{inr(x.price)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {item.addons.length ? (
        <fieldset className="mt-5">
          <legend className="label">Add extra</legend>
          {item.addons.map((a) => (
            <label key={a.id} className="border-line flex min-h-12 items-center justify-between gap-2 border-b">
              <span className="flex items-center gap-3">
                <input type="checkbox" className="accent-indigo size-4" checked={addonIds.includes(a.id)} onChange={(e) => setAddons((s) => (e.target.checked ? [...s, a.id] : s.filter((x) => x !== a.id)))} />
                {a.label}
              </span>
              <span className="price text-sm">+{inr(a.price)}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {item.spice >= 1 ? (
        <fieldset className="mt-5">
          <legend className="label">How hot?</legend>
          <div className="flex flex-wrap gap-2">
            {["Less spicy", "", "Extra spicy"].map((h) => (
              <label key={h || "as-is"} className="border-line-2 has-checked:border-madder has-checked:text-madder has-checked:bg-madder-tint flex min-h-10 items-center rounded-full border-[1.5px] px-3.5 text-sm">
                <input type="radio" name="heat" className="sr-only" checked={heat === h} onChange={() => setHeat(h)} />
                {h || "As the chef makes it"}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <label className="label mt-5" htmlFor="note">
        Note for the kitchen (optional)
      </label>
      <input id="note" className="field" maxLength={100} placeholder="No onion, less oil…" value={note} onChange={(e) => setNote(e.target.value)} />
    </Sheet>
  );
}

/* ---------- Your table ---------- */

const step: Record<LineStatus, { label: string; tone: string; n: number }> = {
  pending: { label: "Waiting for staff to confirm", tone: "text-turmeric-ink", n: 0 },
  queued: { label: "Sent to kitchen", tone: "text-ink-2", n: 1 },
  cooking: { label: "Cooking", tone: "text-indigo", n: 2 },
  ready: { label: "Ready, coming to you", tone: "text-leaf", n: 3 },
  served: { label: "Served", tone: "text-muted", n: 4 },
  cancelled: { label: "Not accepted", tone: "text-madder", n: 0 },
};

function TableView({
  data,
  itemById,
  busy,
  send,
  say,
  onMenu,
  onJoin,
}: {
  data: View;
  itemById: Map<string, Item>;
  busy: boolean;
  send: (b: object) => Promise<string | null>;
  say: (t: string) => void;
  onMenu: () => void;
  onJoin: () => void;
}) {
  const v = data.visit;
  const [payOpen, setPayOpen] = useState(false);
  if (!v || !v.orders.length) {
    return (
      <main className="px-4 py-14 text-center">
        <span className="bg-turmeric-tint text-turmeric-ink mx-auto flex size-16 items-center justify-center rounded-full">
          <UtensilsCrossed className="size-7" aria-hidden="true" />
        </span>
        <p className="dish mt-4 text-2xl">Nothing ordered yet</p>
        <p className="text-ink-2 mt-1">Pick dishes from the menu and send them to the kitchen. You&apos;ll see each one cook here.</p>
        <button type="button" className="btn btn-primary mt-5" onClick={onMenu}>
          See the menu
        </button>
      </main>
    );
  }
  if (v.session.status === "paid") return <AfterPayment data={data} send={send} say={say} />;
  const bill = v.bill;
  return (
    <main className="px-4 pt-2">
      <ol className="space-y-3">
        {v.orders.map((o, i) => (
          <li key={o.id} className="bg-card rounded-2xl p-4 shadow-[0_8px_22px_-16px_rgb(29_26_23/0.45)]">
            <h2 className="text-muted text-sm font-bold">Order {i + 1}</h2>
            <ul className="mt-2 space-y-3">
              {v.lines
                .filter((l) => l.order_id === o.id)
                .map((l) => {
                  const st = step[l.status];
                  return (
                    <li key={l.id} className="flex gap-3">
                      <Thumb item={l.item_id ? itemById.get(l.item_id) : undefined} size="size-14" />
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between gap-3">
                          <span className="dish">
                            {l.qty} × {l.name}
                          </span>
                          <span className="price text-sm">{inr(l.unit_price * l.qty)}</span>
                        </div>
                        {l.variant || l.addons.length || l.note ? <p className="text-muted truncate text-sm">{[l.variant, ...l.addons, l.note].filter(Boolean).join(", ")}</p> : null}
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="flex gap-0.5" aria-hidden="true">
                            {[1, 2, 3, 4].map((n) => (
                              <span key={n} className={`h-1.5 w-5 rounded-full ${l.status !== "cancelled" && n <= st.n ? (l.status === "served" ? "bg-line-2" : l.status === "ready" ? "bg-leaf" : "bg-indigo") : "bg-line"}`} />
                            ))}
                          </span>
                          <span className={`text-sm font-bold ${st.tone}`}>{st.label}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </li>
        ))}
      </ol>

      {v.session.status === "seated" ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-line !min-h-12" onClick={onMenu}>
            <Plus className="size-4" aria-hidden="true" />
            Order more
          </button>
          <button
            type="button"
            className="btn btn-primary !min-h-12"
            disabled={busy}
            onClick={async () => {
              const err = await send({ type: "bill" });
              say(err ?? "Your bill is ready below.");
            }}
          >
            <ReceiptText className="size-4" aria-hidden="true" />
            Get the bill
          </button>
        </div>
      ) : null}

      {v.session.status === "bill" ? (
        <section aria-labelledby="bill" className="bg-card mt-5 overflow-hidden rounded-2xl shadow-[0_8px_22px_-16px_rgb(29_26_23/0.45)]">
          <div className="bg-[#1d1a17] px-4 py-3 text-white">
            <h2 id="bill" className="dish text-xl">
              Bill {v.session.bill_no ? `#${v.session.bill_no}` : ""}
            </h2>
            <p className="text-sm text-white/70">
              {data.restaurant.name}, table {data.table.label}
            </p>
          </div>
          <div className="p-4">
            <dl className="price space-y-1.5 font-medium">
              {bill.lines.map((l) => (
                <Row key={l.id} k={`${l.qty} × ${l.name}`} v={inr(l.unit_price * l.qty)} muted />
              ))}
              <div className="border-line-2 my-2 border-t border-dashed" />
              <Row k="Food and drinks" v={inr(bill.subtotal)} />
              {bill.discount ? <Row k={v.session.discount_label ?? "Reward"} v={`− ${inr(bill.discount)}`} tone="text-leaf" /> : null}
              <Row k={`CGST ${Number(data.restaurant.gst_pct) / 2}%`} v={inr(bill.cgst)} muted />
              <Row k={`SGST ${Number(data.restaurant.gst_pct) / 2}%`} v={inr(bill.sgst)} muted />
              <div className="border-line-2 flex justify-between border-t border-dashed pt-2 text-xl font-bold">
                <dt>Total</dt>
                <dd>{inr(bill.total)}</dd>
              </div>
              {bill.paid ? <Row k="Paid" v={inr(bill.paid)} /> : null}
              {bill.claimed ? <Row k="UPI, being checked" v={inr(bill.claimed)} tone="text-turmeric-ink" /> : null}
            </dl>
            {v.member && v.member.rewards_ready > 0 && !bill.discount ? (
              <button type="button" className="btn btn-turmeric mt-4 w-full" disabled={busy} onClick={async () => say((await send({ type: "reward" })) ?? `${data.restaurant.reward_text} added to your bill.`)}>
                <Gift className="size-4" aria-hidden="true" />
                Use your reward: {data.restaurant.reward_text.toLowerCase()}
              </button>
            ) : null}
            {!v.member ? (
              <button type="button" className="bg-turmeric-tint text-turmeric-ink mt-4 flex w-full items-center gap-2 rounded-xl p-3 text-left text-sm font-bold" onClick={onJoin}>
                <Gift className="size-4 shrink-0" aria-hidden="true" />
                Add your number to collect a stamp on this bill
              </button>
            ) : null}
            {bill.due > 0 ? (
              data.restaurant.pay_at_table && data.restaurant.upi_vpa ? (
                <button type="button" className="btn btn-primary mt-3 !min-h-13 w-full text-base" onClick={() => setPayOpen(true)}>
                  Pay {inr(bill.due)}
                </button>
              ) : (
                <p className="text-ink-2 mt-3 text-sm">Please pay at the counter, or ask for the card machine. Staff have your bill.</p>
              )
            ) : bill.claimed ? (
              <p className="text-turmeric-ink mt-3 text-sm font-bold">Thanks! The cashier is confirming your UPI payment.</p>
            ) : null}
          </div>
        </section>
      ) : null}
      {payOpen ? <PaySheet data={data} send={send} say={say} onClose={() => setPayOpen(false)} /> : null}
    </main>
  );
}

function Row({ k, v, tone = "", muted = false }: { k: string; v: string; tone?: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${tone} ${muted ? "text-ink-2 text-[0.95rem]" : ""}`}>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function PaySheet({ data, send, say, onClose }: { data: View; send: (b: object) => Promise<string | null>; say: (t: string) => void; onClose: () => void }) {
  const due = data.visit!.bill.due;
  const [split, setSplit] = useState(1);
  const [code, setCode] = useState("");
  const [opened, setOpened] = useState(false);
  const share = Math.ceil(due / split);
  const amount = split > 1 ? share : due;
  const link = upiLink({ upi_vpa: data.restaurant.upi_vpa, upi_name: data.restaurant.upi_name, name: data.restaurant.name }, amount, `Table ${data.table.label} bill`);
  return (
    <Sheet title={`Pay ${inr(due)}`} onClose={onClose}>
      <fieldset>
        <legend className="label">Split the bill</legend>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="border-line-2 has-checked:border-indigo has-checked:bg-indigo-tint flex min-h-10 min-w-12 items-center justify-center rounded-full border-[1.5px] px-3 text-sm">
              <input type="radio" name="split" className="sr-only" checked={split === n} onChange={() => setSplit(n)} />
              {n === 1 ? "One payment" : `${n} ways`}
            </label>
          ))}
        </div>
        {split > 1 ? <p className="text-ink-2 mt-2 text-sm">Each pays {inr(share)}. Pay your share; the others can pay from their own phones.</p> : null}
      </fieldset>
      {link ? (
        <>
          <a href={link} onClick={() => setOpened(true)} className="btn btn-primary mt-5 !min-h-13 w-full text-base">
            Pay {inr(amount)} with a UPI app
          </a>
          <p className="text-muted mt-1.5 text-xs">Opens GPay, PhonePe, Paytm or your bank app with the amount filled in, paid straight to {data.restaurant.name}.</p>
          {opened ? (
            <button
              type="button"
              className="btn btn-line mt-3 w-full"
              onClick={async () => {
                const err = await send({ type: "upiPaid", amount });
                onClose();
                say(err ?? "Thanks! The cashier will confirm your payment.");
              }}
            >
              I&apos;ve paid {inr(amount)}
            </button>
          ) : null}
        </>
      ) : null}
      <div className="border-line mt-5 border-t pt-4">
        <label className="label" htmlFor="gift">
          Gift card
        </label>
        <div className="flex gap-2">
          <input id="gift" className="field uppercase" value={code} onChange={(e) => setCode(e.target.value)} />
          <button
            type="button"
            className="btn btn-line shrink-0"
            disabled={code.trim().length < 4}
            onClick={async () => {
              const err = await send({ type: "gift", code: code.trim() });
              say(err ?? "Gift card applied.");
              if (!err) onClose();
            }}
          >
            Use
          </button>
        </div>
      </div>
      <p className="text-muted mt-4 text-sm">Paying by cash or card? Tap Call staff, or pay at the counter.</p>
    </Sheet>
  );
}

function AfterPayment({ data, send, say }: { data: View; send: (b: object) => Promise<string | null>; say: (t: string) => void }) {
  const v = data.visit!;
  const [food, setFood] = useState(0);
  const [service, setService] = useState(0);
  const [comment, setComment] = useState("");
  const m = v.member;
  const of = data.restaurant.stamps_for_reward;
  const full = m && v.session.stamped && m.stamps === 0;
  return (
    <main className="px-4 pt-4">
      <div className="bg-card rounded-2xl p-6 text-center shadow-[0_8px_22px_-16px_rgb(29_26_23/0.45)]">
        <span className="bg-leaf-tint text-leaf mx-auto flex size-16 items-center justify-center rounded-full">
          <CircleCheck className="size-8" aria-hidden="true" />
        </span>
        <p className="dish mt-3 text-2xl">Paid. Thank you!</p>
        <p className="text-ink-2">Hope to see you again at {data.restaurant.name}.</p>
      </div>
      {m ? (
        <section aria-labelledby="card" className="mt-4 rounded-2xl bg-[linear-gradient(135deg,#27326f,#1b2452)] p-5 text-white">
          <h2 id="card" className="font-bold">
            {m.name ? `${m.name.split(" ")[0]}'s card` : "Your card"}
          </h2>
          <div className="mt-3 rounded-xl bg-white p-3">
            <StampCard stamps={full ? of : m.stamps} of={of} fresh={v.session.stamped ? (full ? of - 1 : m.stamps - 1) : -1} />
          </div>
          <p className="mt-3 text-white/85">
            {v.session.stamped
              ? full
                ? `Card full. Your ${data.restaurant.reward_text.toLowerCase()} is ready for your next visit.`
                : `Stamp added. ${of - m.stamps} more ${of - m.stamps === 1 ? "visit" : "visits"} for a ${data.restaurant.reward_text.toLowerCase()}.`
              : `Bills over ${inr(data.restaurant.stamp_min_bill)} earn a stamp.`}
          </p>
        </section>
      ) : null}
      <section aria-labelledby="fb" className="bg-card mt-4 rounded-2xl p-5 shadow-[0_8px_22px_-16px_rgb(29_26_23/0.45)]">
        {v.feedback ? (
          v.feedback.route === "google-ask" ? (
            <div>
              <h2 id="fb" className="font-bold">
                Glad you enjoyed it
              </h2>
              <p className="text-ink-2 mt-1">If you have a minute, a Google review helps other people find us. It&apos;s completely up to you, and there&apos;s no reward for it.</p>
              {data.restaurant.google_review_url ? (
                <a href={data.restaurant.google_review_url} target="_blank" rel="noopener noreferrer" className="btn btn-line mt-3">
                  Write a Google review
                </a>
              ) : null}
            </div>
          ) : (
            <div>
              <h2 id="fb" className="font-bold">
                Sorry it wasn&apos;t right
              </h2>
              <p className="text-ink-2 mt-1">The manager has your note and will follow up.</p>
            </div>
          )
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const err = await send({ type: "feedback", food, service, comment: comment || null });
              if (err) say(err);
            }}
          >
            <h2 id="fb" className="font-bold">
              How was it?
            </h2>
            <p className="text-muted text-sm">It goes straight to the manager.</p>
            <div className="mt-3 space-y-3">
              <Stars label="Food" value={food} onChange={setFood} />
              <Stars label="Service" value={service} onChange={setService} />
            </div>
            <label className="label mt-3" htmlFor="comment">
              Anything to tell us? (optional)
            </label>
            <textarea id="comment" className="field" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
            <button type="submit" className="btn btn-primary mt-3 w-full" disabled={!food || !service}>
              Send feedback
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

/* ---------- Rewards ---------- */

function RewardsView({ data, onJoin }: { data: View; onJoin: () => void }) {
  const m = data.visit?.member;
  const r = data.restaurant;
  return (
    <main className="px-4 pt-2">
      <section aria-labelledby="mycard" className="rounded-2xl bg-[linear-gradient(135deg,#27326f,#1b2452)] p-5 text-white">
        <p className="text-sm text-white/70">{r.name} rewards</p>
        <h2 id="mycard" className="dish text-2xl">
          {m ? (m.name ?? "Your card") : "Collect stamps, eat free"}
        </h2>
        <div className="mt-4 rounded-xl bg-white p-3">
          <StampCard stamps={m?.stamps ?? 0} of={r.stamps_for_reward} />
        </div>
        <p className="mt-3 text-white/85">
          {m
            ? `${m.stamps} of ${r.stamps_for_reward} stamps. Every visit over ${inr(r.stamp_min_bill)} earns one; a full card gets you a ${r.reward_text.toLowerCase()}.`
            : `Every visit over ${inr(r.stamp_min_bill)} earns a stamp. Fill ${r.stamps_for_reward} and your next ${r.reward_text.toLowerCase()} is on us. Just your phone number, no app.`}
        </p>
        {m?.rewards_ready ? (
          <p className="bg-turmeric mt-4 flex items-center gap-2 rounded-lg p-3 font-bold text-[#241800]">
            <Sparkles className="size-5" aria-hidden="true" />
            {m.rewards_ready} reward ready. Use it on today&apos;s bill.
          </p>
        ) : null}
        {!m ? (
          <button type="button" className="btn btn-turmeric mt-4" onClick={onJoin}>
            Join with your number
          </button>
        ) : null}
      </section>
      <section className="bg-card mt-4 rounded-2xl p-5 shadow-[0_8px_22px_-16px_rgb(29_26_23/0.45)]">
        <h2 className="dish text-xl">Gift a meal</h2>
        <p className="text-ink-2 mt-1">Gift cards are sold at the counter and work on any bill, here or at the table.</p>
      </section>
    </main>
  );
}

function JoinSheet({ data, onClose, send, say }: { data: View; onClose: () => void; send: (b: object) => Promise<string | null>; say: (t: string) => void }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [optIn, setOptIn] = useState(false);
  return (
    <Sheet title="Join rewards" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const err = await send({ type: "join", phone: phone.startsWith("+") ? phone : `+91${phone.replace(/\D/g, "")}`, name: name || null, optIn });
          if (err) return say(err);
          onClose();
          say("You're in. This visit's stamp goes on your card when you pay.");
        }}
      >
        <p className="text-ink-2">
          Every visit over {inr(data.restaurant.stamp_min_bill)} earns a stamp. {data.restaurant.stamps_for_reward} stamps get you a {data.restaurant.reward_text.toLowerCase()}.
        </p>
        <label className="label mt-4" htmlFor="phone">
          Mobile number
        </label>
        <div className="flex">
          <span className="border-line-2 bg-ground flex items-center rounded-l-[var(--radius-ctl)] border-[1.5px] border-r-0 px-3 text-sm font-bold">+91</span>
          <input id="phone" className="field !rounded-l-none" inputMode="numeric" autoComplete="tel-national" maxLength={11} required value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))} />
        </div>
        <label className="label mt-3" htmlFor="name">
          First name (optional)
        </label>
        <input id="name" className="field" maxLength={30} autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="mt-4 flex items-start gap-3 text-sm">
          <input type="checkbox" className="accent-indigo mt-0.5 size-4" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
          <span>Send me offers and my birthday treat on WhatsApp. I can stop them any time.</span>
        </label>
        <button type="submit" className="btn btn-primary mt-5 w-full" disabled={phone.length < 10}>
          Join
        </button>
        <p className="text-muted mt-2 text-xs">Your number is used only by {data.restaurant.name} for your rewards{optIn ? " and offers" : ""}.</p>
        <button type="button" className="sr-only" onClick={onClose}>
          <X aria-hidden="true" /> Close
        </button>
      </form>
    </Sheet>
  );
}
