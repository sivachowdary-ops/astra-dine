import { advanceTryTables, tryLive } from "@/lib/server/showcase";

export const dynamic = "force-dynamic";

/** The sales page's live view of the try-it tables. Dishes and statuses only, no guest details. */
export async function GET() {
  await advanceTryTables();
  const live = await tryLive();
  if (!live) return Response.json({ error: "No showcase restaurant." }, { status: 404 });
  return Response.json(live, { headers: { "Cache-Control": "no-store" } });
}
