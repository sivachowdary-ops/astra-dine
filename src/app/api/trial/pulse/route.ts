import { currentStaff } from "@/lib/auth";
import { pumpTrial } from "@/lib/server/trial";

export const dynamic = "force-dynamic";

/** While any screen of a trial copy is open, pretend guests keep the place busy. */
export async function POST() {
  const me = await currentStaff();
  if (!me) return Response.json({ error: "Sign in again." }, { status: 401 });
  if (me.restaurant.expires_at) await pumpTrial(me.restaurant);
  return Response.json({ ok: true });
}
