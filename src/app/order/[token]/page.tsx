import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NotConfigured } from "@/components/not-configured";
import { OrderApp } from "@/components/order/order-app";
import { configured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Order from your table" };

export default async function Order({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{12,40}$/.test(token)) notFound();
  if (!configured) return <NotConfigured />;
  return <OrderApp token={token} />;
}
