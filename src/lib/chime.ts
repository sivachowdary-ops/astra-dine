"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Sounds for busy screens: a new kitchen ticket, a QR order to confirm, a table calling, a UPI
 * payment to check. Made with the browser's own synthesiser (no sound files). Browsers only allow
 * sound after someone taps the page, so each screen has a "Sound on" switch, remembered on the
 * device; once on, the first tap after a reload wakes it up again.
 */

export type Chime = "ticket" | "confirm" | "call" | "payment";

const notes: Record<Chime, [number, number][]> = {
  // [frequency Hz, start offset s]
  ticket: [
    [659, 0],
    [784, 0.16],
    [988, 0.32],
  ],
  confirm: [
    [880, 0],
    [660, 0.22],
  ],
  call: [
    [740, 0],
    [740, 0.18],
  ],
  payment: [[1175, 0]],
};

export function useSound(key: string) {
  const [on, setOn] = useState(false);
  const ctx = useRef<AudioContext | null>(null);
  const storeKey = `dine-sound-${key}`;

  const wake = useCallback(() => {
    if (typeof window === "undefined") return null;
    ctx.current ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.current.state === "suspended") void ctx.current.resume();
    return ctx.current;
  }, []);

  // Remembered "on": wait for the first tap anywhere, then sound works again.
  useEffect(() => {
    const t = window.setTimeout(() => {
      let saved = false;
      try {
        saved = localStorage.getItem(storeKey) === "1";
      } catch {
        // Private mode: off until switched on.
      }
      if (!saved) return;
      setOn(true);
      const first = () => wake();
      window.addEventListener("pointerdown", first, { once: true });
      window.addEventListener("keydown", first, { once: true });
    }, 0);
    return () => window.clearTimeout(t);
  }, [storeKey, wake]);

  const play = useCallback(
    (kind: Chime) => {
      if (!on) return;
      const ac = wake();
      if (!ac || ac.state !== "running") return;
      const start = ac.currentTime + 0.02;
      for (const [freq, at] of notes[kind]) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, start + at);
        gain.gain.exponentialRampToValueAtTime(0.35, start + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.45);
        osc.connect(gain).connect(ac.destination);
        osc.start(start + at);
        osc.stop(start + at + 0.5);
      }
      if ("vibrate" in navigator) navigator.vibrate?.(120);
    },
    [on, wake],
  );

  const toggle = useCallback(() => {
    const next = !on;
    setOn(next);
    try {
      localStorage.setItem(storeKey, next ? "1" : "0");
    } catch {
      // Remembered for this visit only.
    }
    if (next) {
      const ac = wake();
      // A short confirmation, so staff know the speaker works.
      window.setTimeout(() => {
        if (!ac || ac.state !== "running") return;
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.3);
        osc.connect(gain).connect(ac.destination);
        osc.start();
        osc.stop(ac.currentTime + 0.32);
      }, 50);
    }
  }, [on, storeKey, wake]);

  return { on, toggle, play };
}

/** Calls onNew when ids appear that weren't there before (never for what is already showing on load). */
export function useNewItems(ids: string[] | null, onNew: (count: number) => void) {
  const seen = useRef<Set<string> | null>(null);
  const cb = useRef(onNew);
  useEffect(() => {
    cb.current = onNew;
  }, [onNew]);
  const key = ids ? ids.join(",") : null;
  useEffect(() => {
    if (key === null) return;
    const now = key ? key.split(",") : [];
    if (!seen.current) {
      seen.current = new Set(now);
      return;
    }
    const fresh = now.filter((id) => !seen.current!.has(id));
    for (const id of now) seen.current.add(id);
    if (fresh.length) cb.current(fresh.length);
  }, [key]);
}

/** "(3) Kitchen · Astra Dine" while something waits, so a background tab still shows it. */
export function useTitleCount(count: number, base: string) {
  useEffect(() => {
    document.title = count ? `(${count}) ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [count, base]);
}
