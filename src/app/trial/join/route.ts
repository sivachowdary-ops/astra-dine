import { redeem, signInAs } from "@/lib/server/trial";

export const dynamic = "force-dynamic";

/** A QR from the trial dashboard: signs this device in as the kitchen or cashier screen. */
export async function GET(req: Request) {
  const t = await redeem(new URL(req.url).searchParams.get("t") ?? "");
  if (!t) return Response.redirect(new URL("/kitchen?link=used", req.url), 302);
  try {
    await signInAs(t.userId);
  } catch {
    return Response.redirect(new URL(`${t.path}?link=used`, req.url), 302);
  }
  return Response.redirect(new URL(t.path, req.url), 302);
}
