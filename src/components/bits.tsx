"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import type { Diet } from "@/lib/types";

/** India's food marks: green square and dot for veg, brown square and triangle for non-veg. */
export function DietMark({ diet, className = "" }: { diet: Diet; className?: string }) {
  const veg = diet === "veg";
  const label = veg ? "Vegetarian" : diet === "egg" ? "Contains egg" : "Non-vegetarian";
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex size-[0.95rem] shrink-0 items-center justify-center rounded-[2px] border-[1.5px] ${veg ? "border-veg" : "border-nonveg"} ${className}`}
    >
      {veg ? (
        <span className="bg-veg size-[0.42rem] rounded-full" />
      ) : (
        <svg viewBox="0 0 10 9" className="fill-nonveg size-[0.5rem]" aria-hidden="true">
          <path d="M5 0l5 9H0z" />
        </svg>
      )}
    </span>
  );
}

/** Spice in chillies: three slots, filled ones in madder. */
export function Spice({ level }: { level: number }) {
  if (!level) return null;
  const words = ["", "Mild heat", "Spicy", "Very spicy"];
  return (
    <span className="text-madder inline-flex items-center gap-[1px]" role="img" aria-label={words[level]} title={words[level]}>
      {[1, 2, 3].map((i) => (
        <svg key={i} viewBox="0 0 12 16" aria-hidden="true" className={`h-3 w-2.5 ${i <= level ? "fill-current" : "fill-line-2"}`}>
          <path d="M7.4 1.2c.5-.6 1.5-.3 1.5.5 0 .5-.4.8-.8 1 1.4.8 2 2.6 1.6 5.2-.6 3.9-3.6 7.4-7.6 7.9-1 .1-1.5-1.1-.7-1.7 2.6-2 3.9-4.7 4.3-7.4.2-1.3.3-2.6.9-3.6.2-.3.5-.6.8-.8 0-.4 0-.8 0-1.1z" />
        </svg>
      ))}
    </span>
  );
}

/** Bottom sheet on phones, centred dialog on wider screens. */
export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("[data-autofocus], input, button:not([data-close])")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" tabIndex={-1} aria-label="Close" data-close className="absolute inset-0 cursor-default bg-[rgb(29_26_23/0.45)]" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-in bg-card relative flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <h2 className="dish text-[1.35rem]">{title}</h2>
          <button type="button" data-close onClick={onClose} className="btn btn-quiet -mt-1 -mr-3 !px-3" aria-label="Close">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pt-2 pb-5">{children}</div>
        {footer ? <div className="border-line border-t px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div> : null}
      </div>
    </div>
  );
}

/** A Kalamkari-style rosette: the stamp on the loyalty card. */
export function Rosette({ filled, fresh = false, size = 44 }: { filled: boolean; fresh?: boolean; size?: number }) {
  const petals = Array.from({ length: 8 }, (_, i) => i * 45);
  return (
    <svg viewBox="0 0 44 44" width={size} height={size} aria-hidden="true" className={fresh ? "stamp-in" : ""}>
      <circle cx="22" cy="22" r="20.5" fill={filled ? "var(--color-turmeric-tint)" : "none"} stroke={filled ? "var(--color-turmeric)" : "var(--color-line-2)"} strokeWidth="1.5" strokeDasharray={filled ? undefined : "3 3"} />
      {filled ? (
        <g fill="var(--color-turmeric)">
          {petals.map((r) => (
            <ellipse key={r} cx="22" cy="12.5" rx="3.6" ry="6.5" transform={`rotate(${r} 22 22)`} opacity="0.9" />
          ))}
          <circle cx="22" cy="22" r="4.6" fill="var(--color-madder)" />
          <circle cx="22" cy="22" r="1.8" fill="var(--color-turmeric-tint)" />
        </g>
      ) : null}
    </svg>
  );
}

export function StampCard({ stamps, of, fresh = -1 }: { stamps: number; of: number; fresh?: number }) {
  return (
    <div className="flex flex-wrap gap-2" role="img" aria-label={`${stamps} of ${of} stamps`}>
      {Array.from({ length: of }, (_, i) => (
        <Rosette key={i} filled={i < stamps} fresh={i === fresh} />
      ))}
    </div>
  );
}

export function Stars({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="flex size-11 items-center justify-center">
            <input type="radio" name={label} value={n} checked={value === n} onChange={() => onChange(n)} className="peer sr-only" />
            <svg viewBox="0 0 24 24" aria-hidden="true" className={`size-8 transition-colors peer-focus-visible:outline-2 ${n <= value ? "fill-turmeric" : "fill-line"}`}>
              <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
            </svg>
            <span className="sr-only">
              {n} {n === 1 ? "star" : "stars"}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
