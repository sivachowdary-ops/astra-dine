"use client";

import { useState } from "react";
import { call, useLive } from "@/lib/live";
import { browserClient } from "@/lib/supabase/browser";
import type { Restaurant, Staff } from "@/lib/types";
import { H, Notice } from "./admin-app";
import { usePublicBase } from "./tables";

const roleText: Record<string, string> = { owner: "Owner", manager: "Manager", cashier: "Cashier", kitchen: "Kitchen" };

export function StaffSection({ restaurant: r, staff: me }: { restaurant: Restaurant; staff: Staff }) {
  const { data, reload } = useLive(r.id, ["dining_tables"], async () => {
    const { data: s } = await browserClient().from("staff").select("*").eq("restaurant_id", r.id).order("created_at");
    return (s ?? []) as Staff[];
  });
  const base = usePublicBase();
  const [msg, setMsg] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", username: "", role: "cashier", password: "" });
  const admin = async (body: object, ok?: string) => {
    const { error } = await call("/api/admin", body);
    setMsg(error ?? ok ?? null);
    reload();
    return error;
  };
  return (
    <>
      <H sub="Give each device or person their own login. Kitchen logins can only move dishes and mark sold out; cashiers run tables and payments.">Staff and devices</H>
      <Notice text={msg} onDone={() => setMsg(null)} />

      <section aria-labelledby="devices" className="bg-indigo mb-6 rounded-xl p-5 text-white">
        <h2 id="devices" className="dish text-xl">
          Set up your devices
        </h2>
        <p className="mt-1 text-white/80">
          Open these on the kitchen tablet or TV and on the counter computer, and sign in with restaurant code <b className="text-white">{r.slug}</b> and that device&apos;s username.
        </p>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg bg-white/10 p-3">
            <dt className="text-sm text-white/70">Kitchen screen</dt>
            <dd className="font-bold break-all">{base}/kitchen</dd>
          </div>
          <div className="rounded-lg bg-white/10 p-3">
            <dt className="text-sm text-white/70">Cashier</dt>
            <dd className="font-bold break-all">{base}/pos</dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <section aria-labelledby="team" className="bg-card border-line overflow-x-auto rounded-xl border">
          <h2 id="team" className="px-4 pt-4 font-bold">
            Logins
          </h2>
          <table className="table mt-2">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Username</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((s) => (
                <tr key={s.user_id}>
                  <td className="font-bold">{s.name}</td>
                  <td>{s.role === "owner" ? "Email sign-in" : s.username}</td>
                  <td>{roleText[s.role]}</td>
                  <td>{s.active ? "Active" : <span className="text-madder font-bold">Switched off</span>}</td>
                  <td className="text-right whitespace-nowrap">
                    {s.role !== "owner" ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-quiet !min-h-9 text-sm"
                          onClick={() => {
                            const pw = window.prompt(`New password for ${s.name} (6 or more characters)`);
                            if (pw && pw.length >= 6) void admin({ type: "staffUpdate", userId: s.user_id, password: pw }, "Password changed.");
                          }}
                        >
                          New password
                        </button>
                        <button type="button" className="btn btn-quiet !min-h-9 text-sm" onClick={() => void admin({ type: "staffUpdate", userId: s.user_id, active: !s.active }, s.active ? `${s.name} can no longer sign in.` : `${s.name} can sign in again.`)}>
                          {s.active ? "Switch off" : "Switch on"}
                        </button>
                      </>
                    ) : s.user_id === me.user_id ? (
                      <span className="text-muted text-sm">You</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <form
          className="bg-card border-line self-start rounded-xl border p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const err = await admin({ type: "staff", ...f }, `Login created for ${f.name}. Username: ${f.username.toLowerCase()}`);
            if (!err) setF({ name: "", username: "", role: "cashier", password: "" });
          }}
        >
          <h2 className="font-bold">Add a login</h2>
          <label className="label mt-3" htmlFor="s-name">
            Name
          </label>
          <input id="s-name" className="field" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Kitchen tablet, or Ravi" />
          <label className="label mt-3" htmlFor="s-user">
            Username
          </label>
          <input id="s-user" className="field" required pattern="[a-zA-Z0-9._-]{3,24}" autoCapitalize="none" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} placeholder="kitchen" />
          <label className="label mt-3" htmlFor="s-role">
            Role
          </label>
          <select id="s-role" className="field" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="cashier">Cashier: tables, orders, bills, payments</option>
            <option value="kitchen">Kitchen: tickets and sold out</option>
            <option value="manager">Manager: everything, including this dashboard</option>
          </select>
          <label className="label mt-3" htmlFor="s-pass">
            Password (6 or more characters)
          </label>
          <input id="s-pass" className="field" required minLength={6} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <button type="submit" className="btn btn-primary mt-4 w-full">
            Create login
          </button>
        </form>
      </div>
    </>
  );
}
