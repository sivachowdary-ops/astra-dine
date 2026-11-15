import { z } from "zod";
import { db } from "@/lib/server/ops";

export const dynamic = "force-dynamic";

const input = z.object({
  ownerName: z.string().trim().min(2).max(60),
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(72),
  restaurantName: z.string().trim().min(2).max(60),
  place: z.string().trim().max(80).optional(),
  code: z.string().trim().max(40).optional(),
});

const tries = new Map<string, number[]>();

/** A restaurant owner creates their account and their restaurant. */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  const recent = (tries.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= 5) return Response.json({ error: "Too many sign-ups from here. Try again in an hour." }, { status: 429 });
  tries.set(ip, [...recent, now]);

  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the details: a valid email and a password of at least 8 characters." }, { status: 400 });
  const a = parsed.data;
  // Optional invite code, so a public deployment doesn't take sign-ups from anyone.
  const required = process.env.SIGNUP_CODE;
  if (required && a.code !== required) return Response.json({ error: "That invite code isn't right. Ask Astra AI Solutions for one." }, { status: 403 });

  const base = a.restaurantName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "restaurant";
  let slug = base.length >= 3 ? base : `${base}-kitchen`;
  for (let i = 2; ; i++) {
    const { count } = await db().from("restaurants").select("id", { count: "exact", head: true }).eq("slug", slug);
    if (!count) break;
    slug = `${base}-${i}`;
  }

  const { data: user, error } = await db().auth.admin.createUser({ email: a.email, password: a.password, email_confirm: true, user_metadata: { name: a.ownerName } });
  if (error || !user.user) {
    const taken = /already|registered|exists/i.test(error?.message ?? "");
    return Response.json({ error: taken ? "That email already has an account. Sign in instead." : "Couldn't create the account. Try again." }, { status: taken ? 409 : 500 });
  }
  const { data: restaurant, error: rErr } = await db().from("restaurants").insert({ slug, name: a.restaurantName, place: a.place || null }).select("id").single<{ id: string }>();
  if (rErr || !restaurant) {
    await db().auth.admin.deleteUser(user.user.id);
    return Response.json({ error: "Couldn't create the restaurant. Try again." }, { status: 500 });
  }
  await db().from("staff").insert({ user_id: user.user.id, restaurant_id: restaurant.id, name: a.ownerName, username: "owner", role: "owner" });
  return Response.json({ ok: true, slug });
}
