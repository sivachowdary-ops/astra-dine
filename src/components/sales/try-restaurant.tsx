"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

/** Makes the visitor a private copy of the sample restaurant and opens its owner dashboard. */
export function TryRestaurant({ label = "Open my copy of the restaurant" }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch("/api/trial", { method: "POST" });
            const out = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
              setError(out.error ?? "Couldn't set up your copy. Try again.");
              setBusy(false);
              return;
            }
            router.push("/admin");
          } catch {
            setError("No connection. Try again.");
            setBusy(false);
          }
        }}
        className="bg-turmeric hover:bg-[#d0901a] inline-flex min-h-14 items-center gap-3 rounded-xl px-7 text-lg font-bold text-[#1d1a17] disabled:opacity-70"
      >
        {busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : null}
        {busy ? "Setting up your restaurant…" : label}
      </button>
      {error ? (
        <p role="alert" className="text-madder mt-3 text-sm font-bold">
          {error}
        </p>
      ) : null}
    </div>
  );
}
