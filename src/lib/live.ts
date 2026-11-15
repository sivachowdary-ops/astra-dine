"use client";

import { useEffect, useRef, useState } from "react";
import { browserClient } from "./supabase/browser";

/**
 * Loads data for a staff screen and reloads it whenever any of the given tables change for
 * this restaurant (Supabase Realtime), with a slow safety refresh in case a message is missed.
 */
export function useLive<T>(restaurantId: string, tables: string[], load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [online, setOnline] = useState(true);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  const reloadRef = useRef<() => void>(() => {});
  const key = tables.join(",");

  useEffect(() => {
    let alive = true;
    let timer = 0;
    let busy = false;
    let again = false;
    const run = async () => {
      if (busy) {
        again = true;
        return;
      }
      busy = true;
      try {
        const next = await loadRef.current();
        if (alive) setData(next);
      } catch {
        if (alive) setOnline(false);
      } finally {
        busy = false;
        if (again && alive) {
          again = false;
          void run();
        }
      }
    };
    const soon = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void run(), 250);
    };
    reloadRef.current = () => void run();
    void run();
    const supabase = browserClient();
    let channel = supabase.channel(`r-${restaurantId}-${key}`);
    for (const table of key.split(",")) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `restaurant_id=eq.${restaurantId}` }, soon);
    }
    channel.subscribe((status: string) => setOnline(status === "SUBSCRIBED"));
    const slow = window.setInterval(() => void run(), 30_000);
    const wake = () => {
      if (document.visibilityState === "visible") void run();
    };
    document.addEventListener("visibilitychange", wake);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      window.clearInterval(slow);
      document.removeEventListener("visibilitychange", wake);
      void supabase.removeChannel(channel);
    };
  }, [restaurantId, key]);

  return { data, online, reload: () => reloadRef.current() };
}

/** Calls a staff or admin action. Returns the server's message if it refused, else null. */
export async function call(path: "/api/staff" | "/api/admin", body: object): Promise<{ error: string | null; data?: Record<string, unknown> }> {
  try {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return res.ok ? { error: null, data } : { error: (data.error as string) ?? "That didn't go through. Try again." };
  } catch {
    return { error: "No connection. Check the internet and try again." };
  }
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}
