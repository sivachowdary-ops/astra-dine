"use client";

import { TriangleAlert } from "lucide-react";
import { call, useLive, useNow } from "@/lib/live";
import { ago } from "@/lib/rules";
import { browserClient } from "@/lib/supabase/browser";
import type { Feedback, Restaurant } from "@/lib/types";
import { Figure, H } from "./admin-app";

export function FeedbackSection({ restaurant: r }: { restaurant: Restaurant }) {
  const { data, reload } = useLive(r.id, ["feedback"], async () => {
    const { data: f } = await browserClient().from("feedback").select("*").eq("restaurant_id", r.id).order("at", { ascending: false }).limit(200);
    return (f ?? []) as Feedback[];
  });
  const now = useNow(60_000);
  if (!data) return <p className="text-muted">Loading feedback…</p>;
  const avg = (k: "food" | "service") => (data.length ? (data.reduce((s, f) => s + f[k], 0) / data.length).toFixed(1) : "–");
  return (
    <>
      <H sub="Happy guests are asked, with no reward attached, whether they'd post on Google. Unhappy guests come straight to you, so you can put it right the same day.">Feedback</H>
      <dl className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <Figure k="Food" v={avg("food")} sub="out of 5, last 200" />
        <Figure k="Service" v={avg("service")} sub="out of 5, last 200" />
        <Figure k="To follow up" v={String(data.filter((f) => f.route === "manager" && !f.handled).length)} sub="low scores not yet handled" />
      </dl>
      <ul className="mt-6 space-y-3">
        {data.map((f) => (
          <li key={f.id} className={`bg-card rounded-xl border p-4 ${f.route === "manager" && !f.handled ? "border-madder" : "border-line"}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-bold">
                {f.route === "manager" && !f.handled ? <TriangleAlert className="text-madder mr-1.5 inline size-4" aria-hidden="true" /> : null}
                Table {f.table_label}
                {f.guest_name ? `, ${f.guest_name}` : ""}
              </p>
              <p className="text-muted text-sm">{ago(f.at, now)} ago</p>
            </div>
            <p className="mt-1 text-sm">
              Food {f.food}/5, service {f.service}/5
            </p>
            {f.comment ? <p className="text-ink-2 mt-1">&ldquo;{f.comment}&rdquo;</p> : null}
            {f.route === "manager" ? (
              f.handled ? (
                <p className="text-leaf mt-2 text-sm font-bold">Followed up</p>
              ) : (
                <button type="button" className="btn btn-line mt-2 !min-h-9 text-sm" onClick={() => void call("/api/admin", { type: "feedbackHandled", id: f.id }).then(reload)}>
                  Mark as followed up
                </button>
              )
            ) : null}
          </li>
        ))}
        {!data.length ? <li className="text-muted">No feedback yet. Guests are asked after they pay.</li> : null}
      </ul>
    </>
  );
}
