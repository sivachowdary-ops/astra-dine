"use client";

import { useState } from "react";
import type { Restaurant, Staff } from "@/lib/types";
import { SignOut } from "../staff-login";
import { FeedbackSection } from "./feedback";
import { LoyaltySection, OffersSection } from "./loyalty";
import { MenuSection } from "./menu";
import { ReportsSection } from "./reports";
import { SettingsSection } from "./settings";
import { StaffSection } from "./staff";
import { TablesSection } from "./tables";
import { TodaySection } from "./today";
import { TrialPanel } from "../trial-panel";

const sections = [
  { id: "today", label: "Today" },
  { id: "menu", label: "Menu" },
  { id: "tables", label: "Tables and QR codes" },
  { id: "staff", label: "Staff and devices" },
  { id: "loyalty", label: "Loyalty" },
  { id: "offers", label: "WhatsApp offers" },
  { id: "feedback", label: "Feedback" },
  { id: "reports", label: "Reports" },
  { id: "settings", label: "Settings" },
] as const;
export type Section = (typeof sections)[number]["id"];

/** The owner's control centre. Every change here reaches the tables, kitchen and cashier at once. */
export function AdminApp({ restaurant, staff }: { restaurant: Restaurant; staff: Staff }) {
  const [section, setSection] = useState<Section>("today");
  const props = { restaurant, staff };
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="border-line bg-card lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:block lg:py-5">
          <div className="min-w-0">
            <p className="dish truncate text-lg leading-tight">{restaurant.name}</p>
            <p className="text-muted truncate text-xs">
              {staff.name}, {staff.role}
            </p>
          </div>
          <SignOut className="btn btn-quiet !min-h-9 text-sm lg:hidden" />
        </div>
        <nav aria-label="Admin" className="border-line flex gap-1 overflow-x-auto border-y px-2 py-2 lg:flex-col lg:border-y-0 lg:px-3">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-current={section === s.id ? "page" : undefined}
              onClick={() => setSection(s.id)}
              className={`min-h-10 shrink-0 rounded-lg px-3 text-left text-[0.95rem] ${section === s.id ? "bg-ink font-bold text-white" : "text-ink-2 hover:bg-ground"}`}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto hidden px-4 py-4 lg:block">
          <SignOut className="text-muted text-sm underline underline-offset-2" />
        </div>
      </aside>
      <main className="min-w-0 p-4 lg:p-8">
        {restaurant.expires_at ? <TrialPanel restaurant={restaurant} /> : null}
        {section === "today" ? <TodaySection {...props} go={setSection} /> : null}
        {section === "menu" ? <MenuSection {...props} /> : null}
        {section === "tables" ? <TablesSection {...props} /> : null}
        {section === "staff" ? <StaffSection {...props} /> : null}
        {section === "loyalty" ? <LoyaltySection {...props} /> : null}
        {section === "offers" ? <OffersSection {...props} /> : null}
        {section === "feedback" ? <FeedbackSection {...props} /> : null}
        {section === "reports" ? <ReportsSection {...props} /> : null}
        {section === "settings" ? <SettingsSection {...props} /> : null}
      </main>
    </div>
  );
}

export function H({ children, sub, action }: { children: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="dish text-[1.9rem]">{children}</h1>
        {sub ? <p className="text-ink-2 mt-0.5 max-w-3xl">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Figure({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="bg-card border-line rounded-xl border p-4">
      <dt className="text-muted text-sm">{k}</dt>
      <dd className="num mt-1 text-[1.8rem] leading-none font-bold">{v}</dd>
      {sub ? <dd className="text-ink-2 mt-1.5 text-sm">{sub}</dd> : null}
    </div>
  );
}

export function Notice({ text, onDone }: { text: string | null; onDone: () => void }) {
  if (!text) return null;
  return (
    <p role="status" className="bg-ink mb-4 flex items-center justify-between gap-3 rounded-lg px-4 py-2.5 text-sm font-bold text-white">
      {text}
      <button type="button" className="underline" onClick={onDone}>
        Dismiss
      </button>
    </p>
  );
}
