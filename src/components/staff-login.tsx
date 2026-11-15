"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { staffEmail } from "@/lib/rules";
import { browserClient } from "@/lib/supabase/browser";

/**
 * Sign-in for a restaurant device: the kitchen screen or the cashier. Staff use the username
 * the owner gave them; the restaurant code is remembered on the device after the first time.
 */
export function StaffLogin({ app, title, dark = false }: { app: "kitchen" | "pos"; title: string; dark?: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState(() => {
    try {
      return typeof window === "undefined" ? "" : (localStorage.getItem("dine-restaurant") ?? "");
    } catch {
      return "";
    }
  });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const login = username.trim();
    const email = login.includes("@") ? login : staffEmail(code.trim().toLowerCase(), login);
    const { error: err } = await browserClient().auth.signInWithPassword({ email, password });
    if (err) {
      setError("That restaurant code, username or password isn't right.");
      setBusy(false);
      return;
    }
    try {
      localStorage.setItem("dine-restaurant", code.trim().toLowerCase());
    } catch {
      // Fine without storage.
    }
    router.refresh();
  };

  const field = dark ? "field !bg-pass-2 !border-pass-3 !text-white" : "field";
  return (
    <main className={`grid min-h-dvh place-items-center p-5 ${dark ? "bg-pass text-white" : ""}`}>
      <form onSubmit={submit} className={`w-full max-w-sm rounded-2xl p-6 ${dark ? "bg-pass-2" : "bg-card border-line border"}`}>
        <p className={`text-sm font-bold ${dark ? "text-white/60" : "text-muted"}`}>Astra Dine</p>
        <h1 className="dish mt-1 text-3xl">{title}</h1>
        <label className={`label mt-6 ${dark ? "!text-white/80" : ""}`} htmlFor="code">
          Restaurant code
        </label>
        <input id="code" className={field} autoCapitalize="none" autoComplete="organization" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. kaaram-kitchen" required />
        <label className={`label mt-4 ${dark ? "!text-white/80" : ""}`} htmlFor="user">
          Username
        </label>
        <input id="user" className={field} autoCapitalize="none" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <label className={`label mt-4 ${dark ? "!text-white/80" : ""}`} htmlFor="pass">
          Password
        </label>
        <input id="pass" type="password" className={field} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error ? (
          <p role="alert" className="text-madder mt-3 text-sm font-bold">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={busy} className="btn btn-primary mt-6 !min-h-12 w-full text-base">
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className={`mt-4 text-sm ${dark ? "text-white/60" : "text-muted"}`}>
          {app === "kitchen" ? "Ask the owner for the kitchen login." : "Ask the owner for your cashier login."} Owners can sign in with their email too.
        </p>
      </form>
    </main>
  );
}

export function SignOut({ className = "" }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        if (!window.confirm("Sign out of this device?")) return;
        await browserClient().auth.signOut();
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
