import type { Metadata } from "next";
import { NotConfigured } from "@/components/not-configured";
import { PosApp } from "@/components/pos/pos-app";
import { StaffLogin } from "@/components/staff-login";
import { currentStaff } from "@/lib/auth";
import { configured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Cashier" };
export const dynamic = "force-dynamic";

export default async function Pos() {
  if (!configured) return <NotConfigured />;
  const me = await currentStaff(["cashier", "manager"]);
  if (!me) return <StaffLogin app="pos" title="Cashier" />;
  return <PosApp restaurant={me.restaurant} staff={me.staff} />;
}
