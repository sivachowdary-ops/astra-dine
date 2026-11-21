"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { call, useLive, useNow } from "@/lib/live";
import { inr } from "@/lib/rules";
import { browserClient } from "@/lib/supabase/browser";
import type { Campaign, GiftCard, Member, Restaurant } from "@/lib/types";
import { Figure, H, Notice } from "./admin-app";

const DAY = 86_400_000;

async function loadMembers(rid: string) {
  const db = browserClient();
  const [m, g, c] = await Promise.all([
    db.from("members").select("*").eq("restaurant_id", rid).order("last_visit", { ascending: false, nullsFirst: false }).limit(5000),
    db.from("gift_cards").select("*").eq("restaurant_id", rid).order("issued_at", { ascending: false }),
    db.from("campaigns").select("*").eq("restaurant_id", rid).order("created_at", { ascending: false }),
  ]);
  return { members: (m.data ?? []) as Member[], gifts: (g.data ?? []) as GiftCard[], campaigns: (c.data ?? []) as Campaign[] };
}

export function LoyaltySection({ restaurant: r }: { restaurant: Restaurant }) {
  const { data, reload } = useLive(r.id, ["table_sessions"], () => loadMembers(r.id));
  const now = useNow(60_000);
  const [q, setQ] = useState("");
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const act = async (body: object, done: string) => {
    const { error } = await call("/api/admin", body);
    setNote({ text: error ?? done, ok: !error });
    if (!error) reload();
  };
  if (!data) return <p className="text-muted">Loading members…</p>;
  const { members, gifts } = data;
  const repeat = members.filter((m) => m.visits >= 2).length;
  const needle = q.trim().toLowerCase();
  const shown = members.filter((m) => !needle || (m.name ?? "").toLowerCase().includes(needle) || m.phone.includes(needle)).slice(0, 100);
  return (
    <>
      <H sub={`${r.stamps_for_reward} stamps for a ${r.reward_text.toLowerCase()}, one per visit over ${inr(r.stamp_min_bill)}. Change these under Settings.`}>Loyalty</H>
      <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Figure k="Members" v={members.length.toLocaleString("en-IN")} sub={`${members.filter((m) => now - new Date(m.joined_at).getTime() < 30 * DAY).length} joined in 30 days`} />
        <Figure k="Came back" v={members.length ? `${Math.round((repeat / members.length) * 100)}%` : "–"} sub="visited two times or more" />
        <Figure k="Rewards waiting" v={String(members.reduce((s, m) => s + m.rewards_ready, 0))} sub="earned, not yet used" />
        <Figure k="Gift card balance" v={inr(gifts.reduce((s, g) => s + g.balance, 0))} sub={`${gifts.length} cards sold: food you owe`} />
      </dl>
      <p className="text-ink-2 mt-6 max-w-2xl text-sm">
        If a guest asks you to stop offers or forget them, use the buttons on their row. Deleting removes their number, name, stamps and rewards. See the{" "}
        <a href="/privacy" target="_blank" className="text-indigo font-bold underline">
          privacy policy
        </a>{" "}
        guests are shown.
      </p>
      {note ? (
        <p role="status" className={`mt-2 text-sm font-bold ${note.ok ? "text-leaf" : "text-madder"}`}>
          {note.text}
        </p>
      ) : null}
      <div className="relative mt-4 max-w-sm">
        <Search className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden="true" />
        <input type="search" className="field !pl-9" placeholder="Name or phone" aria-label="Search members" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="bg-card border-line mt-3 overflow-x-auto rounded-xl border">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Member</th>
              <th scope="col">Phone</th>
              <th scope="col" className="!text-right">Visits</th>
              <th scope="col" className="!text-right">Spent</th>
              <th scope="col">Card</th>
              <th scope="col">Last visit</th>
              <th scope="col">Offers</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => (
              <tr key={m.id}>
                <td className="font-bold">{m.name ?? "–"}</td>
                <td className="num">{m.phone}</td>
                <td className="num text-right">{m.visits}</td>
                <td className="num text-right">{inr(m.spend)}</td>
                <td>
                  {m.stamps}/{r.stamps_for_reward}
                  {m.rewards_ready ? <span className="text-turmeric-ink font-bold">, reward ready</span> : null}
                </td>
                <td>{m.last_visit ? `${Math.round((now - new Date(m.last_visit).getTime()) / DAY)} days ago` : "–"}</td>
                <td>{m.opt_in ? "Yes" : "No"}</td>
                <td className="whitespace-nowrap text-right">
                  {m.opt_in ? (
                    <button type="button" className="btn btn-quiet !min-h-9 !px-2.5 text-sm" aria-label={`Stop offers for ${m.name ?? m.phone}`} onClick={() => void act({ type: "memberOffersOff", id: m.id }, "Offers stopped for this member.")}>
                      Stop offers
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-quiet text-madder !min-h-9 !px-2.5 text-sm"
                    aria-label={`Delete ${m.name ?? m.phone} and their details`}
                    onClick={() => window.confirm(`Delete ${m.name ?? m.phone}'s card, phone number and name? Their stamps and rewards go too. Past bills stay, without their details.`) && void act({ type: "deleteMember", id: m.id }, "Member and their details deleted.")}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!shown.length ? (
              <tr>
                <td colSpan={8} className="text-muted py-6 text-center">
                  {members.length ? "Nobody matches." : "No members yet. Guests join from their phone at the table, or the cashier adds their number."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function OffersSection({ restaurant: r }: { restaurant: Restaurant }) {
  const { data, reload } = useLive(r.id, ["table_sessions"], () => loadMembers(r.id));
  const now = useNow(60_000);
  const [seg, setSeg] = useState("lapsed");
  const [msg, setMsg] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const segments = useMemo(() => {
    const opted = (data?.members ?? []).filter((m) => m.opt_in);
    const lastAgo = (m: Member) => (m.last_visit ? now - new Date(m.last_visit).getTime() : Infinity);
    return [
      { id: "lapsed", label: "Haven't come in 30 days", detail: "Two visits or more, then nothing for a month", list: opted.filter((m) => m.visits >= 2 && lastAgo(m) > 30 * DAY), text: `Hi {name}, we miss you at ${r.name}! Come in this week and your filter coffee is on us.` },
      { id: "close", label: "One stamp from a reward", detail: `${r.stamps_for_reward - 1} of ${r.stamps_for_reward} stamps`, list: opted.filter((m) => m.stamps === r.stamps_for_reward - 1), text: `{name}, one more visit and your ${r.reward_text.toLowerCase()} is ready. See you soon at ${r.name}!` },
      { id: "regulars", label: "Regulars", detail: "Five visits or more", list: opted.filter((m) => m.visits >= 5), text: `{name}, you're one of our regulars, so you hear first: we've added new dishes at ${r.name}. Try them this weekend.` },
      { id: "new", label: "New this month", detail: "Joined in the last 30 days", list: opted.filter((m) => now - new Date(m.joined_at).getTime() < 30 * DAY), text: `Thanks for joining ${r.name} rewards, {name}. Every visit over ${inr(r.stamp_min_bill)} earns a stamp.` },
      { id: "all", label: "Everyone who agreed", detail: "All members who said yes to offers", list: opted, text: `This Sunday at ${r.name}: special Andhra meals, 12 to 4 pm.` },
    ];
  }, [data, now, r]);
  if (!data) return <p className="text-muted">Loading…</p>;
  const current = segments.find((s) => s.id === seg)!;
  const text = msg || current.text;
  const csv = () => {
    const rows = [["name", "phone", "message"], ...current.list.map((m) => [m.name ?? "", m.phone, text.replace("{name}", (m.name ?? "").split(" ")[0] || "there")])];
    const blob = new Blob([rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${current.id}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <>
      <H sub="Only members who said yes to offers are included. Sending straight from here needs a WhatsApp Business provider; until it's connected, download the list and send it with your provider or WhatsApp Business app.">WhatsApp offers</H>
      <Notice text={note} onDone={() => setNote(null)} />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <section aria-labelledby="who" className="bg-card border-line rounded-xl border p-4">
          <h2 id="who" className="font-bold">
            Who gets it
          </h2>
          <ul className="mt-2 space-y-1.5">
            {segments.map((s) => (
              <li key={s.id}>
                <label className="border-line has-checked:border-indigo has-checked:bg-indigo-tint flex items-center gap-3 rounded-lg border-[1.5px] p-3">
                  <input
                    type="radio"
                    name="seg"
                    className="accent-indigo size-4"
                    checked={seg === s.id}
                    onChange={() => {
                      setSeg(s.id);
                      setMsg("");
                    }}
                  />
                  <span className="flex-1">
                    <span className="block font-bold">{s.label}</span>
                    <span className="text-muted text-sm">{s.detail}</span>
                  </span>
                  <span className="num font-bold">{s.list.length}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="what" className="bg-card border-line rounded-xl border p-4">
          <h2 id="what" className="font-bold">
            Message
          </h2>
          <label className="label mt-2" htmlFor="msg">
            Text ({"{name}"} becomes each guest&apos;s first name)
          </label>
          <textarea id="msg" className="field" rows={5} maxLength={600} value={text} onChange={(e) => setMsg(e.target.value)} />
          <p className="text-ink-2 mt-3 text-sm">
            {current.list.length} people. WhatsApp charges per marketing message, roughly ₹1 each with a provider; check your provider&apos;s rate.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!current.list.length}
              onClick={async () => {
                csv();
                const { error } = await call("/api/admin", { type: "campaign", name: current.label, segment: current.id, message: text, recipients: current.list.length });
                setNote(error ?? `List of ${current.list.length} downloaded and the offer saved below.`);
                reload();
              }}
            >
              <Download className="size-4" aria-hidden="true" />
              Download list with messages
            </button>
          </div>
        </section>
      </div>
      <section aria-labelledby="sent" className="mt-6">
        <h2 id="sent" className="font-bold">
          Offers made
        </h2>
        {data.campaigns.length ? (
          <ul className="bg-card border-line divide-line mt-2 divide-y rounded-xl border">
            {data.campaigns.map((c) => (
              <li key={c.id} className="p-4">
                <p className="font-bold">
                  {c.name} <span className="text-muted font-normal">to {c.recipients}, {new Date(c.created_at).toLocaleDateString("en-IN")}</span>
                </p>
                <p className="text-ink-2 text-sm">{c.message}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted mt-1 text-sm">None yet.</p>
        )}
      </section>
    </>
  );
}
