"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";

/** The owner's door: sign in, or create an account and a restaurant. */
export function AdminLogin({ needsCode }: { needsCode: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [f, setF] = useState({ ownerName: "", email: "", password: "", restaurantName: "", place: "", code: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (mode === "up") {
      const res = await fetch("/api/admin/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Couldn't create the account.");
        setBusy(false);
        return;
      }
    }
    const { error: err } = await browserClient().auth.signInWithPassword({ email: f.email.trim(), password: f.password });
    if (err) {
      setError("That email or password isn't right.");
      setBusy(false);
      return;
    }
    router.refresh();
  };

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <section className="bg-indigo hidden flex-col justify-between p-10 text-white lg:flex">
        <p className="font-bold text-white/70">Astra Dine</p>
        <div>
          <h1 className="dish text-5xl leading-tight">Your restaurant, run from one place.</h1>
          <p className="mt-4 max-w-md text-lg text-white/80">Menu, table QR codes, staff logins, the kitchen screen, billing and the loyalty card. Change a price here and every table sees it.</p>
        </div>
        <p className="text-sm text-white/60">By Astra AI Solutions</p>
      </section>
      <section className="grid place-items-center p-5">
        <form onSubmit={submit} className="w-full max-w-md">
          <h2 className="dish text-3xl">{mode === "in" ? "Sign in" : "Create your restaurant"}</h2>
          <p className="text-ink-2 mt-1">{mode === "in" ? "Owners and managers." : "Takes a minute. You can add the menu right after."}</p>
          {mode === "up" ? (
            <>
              <Field id="rname" label="Restaurant name" value={f.restaurantName} onChange={set("restaurantName")} required />
              <Field id="place" label="Area and city" value={f.place} onChange={set("place")} placeholder="Benz Circle, Vijayawada" />
              <Field id="oname" label="Your name" value={f.ownerName} onChange={set("ownerName")} required />
            </>
          ) : null}
          <Field id="email" label="Email" type="email" value={f.email} onChange={set("email")} autoComplete="email" required />
          <Field id="password" label={mode === "up" ? "Password (8 or more characters)" : "Password"} type="password" value={f.password} onChange={set("password")} autoComplete={mode === "up" ? "new-password" : "current-password"} required minLength={mode === "up" ? 8 : undefined} />
          {mode === "up" && needsCode ? <Field id="code" label="Invite code" value={f.code} onChange={set("code")} required /> : null}
          {error ? (
            <p role="alert" className="text-madder mt-3 text-sm font-bold">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary mt-6 !min-h-12 w-full text-base" disabled={busy}>
            {busy ? "One moment…" : mode === "in" ? "Sign in" : "Create restaurant"}
          </button>
          <p className="text-ink-2 mt-4 text-center text-sm">
            {mode === "in" ? "New here? " : "Already have an account? "}
            <button type="button" className="text-indigo font-bold underline underline-offset-2" onClick={() => setMode(mode === "in" ? "up" : "in")}>
              {mode === "in" ? "Create your restaurant" : "Sign in"}
            </button>
          </p>
        </form>
      </section>
    </main>
  );
}

function Field({ id, label, ...rest }: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <>
      <label className="label mt-4" htmlFor={id}>
        {label}
      </label>
      <input id={id} className="field" {...rest} />
    </>
  );
}
