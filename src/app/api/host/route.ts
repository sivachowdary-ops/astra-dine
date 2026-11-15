import os from "node:os";

export const dynamic = "force-dynamic";

/** The address phones on the same Wi-Fi can open, for the table QR codes. */
export async function GET(req: Request) {
  const port = new URL(req.url).port;
  const lan = Object.values(os.networkInterfaces())
    .flat()
    .find(
      (n) =>
        n &&
        n.family === "IPv4" &&
        !n.internal &&
        /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address),
    );
  return Response.json({ lan: lan ? `http://${lan.address}${port ? `:${port}` : ""}` : null });
}
