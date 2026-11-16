import { pickTryTable } from "@/lib/server/showcase";

export const dynamic = "force-dynamic";

/** The QR on the sales page: seats the visitor at a free try-it table and opens its menu. */
export async function GET(req: Request) {
  const table = await pickTryTable();
  if (!table) return new Response("The demo isn't set up yet.", { status: 503 });
  return Response.redirect(new URL(`/order/${table.qr_token}`, req.url), 302);
}
