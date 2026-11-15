import "server-only";
import { adminClient, userClient } from "./supabase/server";
import type { Restaurant, Role, Staff } from "./types";

/** Who is calling, and whether they may. Null when signed out or not allowed. */
export async function currentStaff(roles?: Role[]): Promise<{ staff: Staff; restaurant: Restaurant } | null> {
  const supabase = await userClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const db = adminClient();
  const { data: staff } = await db.from("staff").select("*").eq("user_id", data.user.id).eq("active", true).maybeSingle<Staff>();
  if (!staff) return null;
  if (roles && !roles.includes(staff.role) && staff.role !== "owner") return null;
  const { data: restaurant } = await db.from("restaurants").select("*").eq("id", staff.restaurant_id).single<Restaurant>();
  if (!restaurant) return null;
  return { staff, restaurant };
}
