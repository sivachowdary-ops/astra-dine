import { TrialError, createTrial, signInAs } from "@/lib/server/trial";

export const dynamic = "force-dynamic";

const hits = new Map<string, number[]>();
const tooMany = (ip: string) => {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 4;
};

/** Makes a private copy of the sample restaurant and signs this browser in as its owner. */
export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "local";
  // Requests with no forwarded address only happen on a developer's own machine.
  if (ip !== "local" && tooMany(ip)) return Response.json({ error: "You've made a few copies already. Use the one you have, or try again in an hour." }, { status: 429 });
  try {
    const t = await createTrial();
    await signInAs(t.ownerId);
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof TrialError) return Response.json({ error: e.message }, { status: 409 });
    console.error("[trial] failed:", (e as Error).message);
    return Response.json({ error: "Couldn't set up your copy. Try again." }, { status: 500 });
  }
}
