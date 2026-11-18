import { z } from "zod";
import { currentStaff } from "@/lib/auth";
import { TrialError, deviceLink } from "@/lib/server/trial";

export const dynamic = "force-dynamic";

/** The owner of a trial copy gets a one-time link that signs another device in as a screen. */
export async function POST(req: Request) {
  const parsed = z.object({ role: z.enum(["kitchen", "cashier"]) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pick a screen." }, { status: 400 });
  const me = await currentStaff(["owner"]);
  if (!me) return Response.json({ error: "Sign in again." }, { status: 401 });
  try {
    const token = await deviceLink(me.restaurant.id, parsed.data.role);
    return Response.json({ url: new URL(`/trial/join?t=${token}`, req.url).toString() });
  } catch (e) {
    if (e instanceof TrialError) return Response.json({ error: e.message }, { status: 409 });
    return Response.json({ error: "Couldn't make the link. Try again." }, { status: 500 });
  }
}
