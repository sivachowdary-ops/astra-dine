import type { Metadata } from "next";
import { AdminApp } from "@/components/admin/admin-app";
import { AdminLogin } from "@/components/admin/login";
import { NotConfigured } from "@/components/not-configured";
import { currentStaff } from "@/lib/auth";
import { configured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function Admin() {
  if (!configured) return <NotConfigured />;
  const me = await currentStaff(["manager"]);
  if (!me) return <AdminLogin needsCode={Boolean(process.env.SIGNUP_CODE)} />;
  return <AdminApp restaurant={me.restaurant} staff={me.staff} />;
}
