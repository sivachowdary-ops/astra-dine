import type { Metadata } from "next";
import { KitchenApp } from "@/components/kitchen/kitchen-app";
import { NotConfigured } from "@/components/not-configured";
import { StaffLogin } from "@/components/staff-login";
import { currentStaff } from "@/lib/auth";
import { configured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Kitchen" };
export const dynamic = "force-dynamic";

export default async function Kitchen() {
  if (!configured) return <NotConfigured />;
  const me = await currentStaff(["kitchen", "manager"]);
  if (!me) return <StaffLogin app="kitchen" title="Kitchen screen" dark />;
  return <KitchenApp restaurant={me.restaurant} staff={me.staff} />;
}
