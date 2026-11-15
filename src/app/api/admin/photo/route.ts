import { currentStaff } from "@/lib/auth";
import { db } from "@/lib/server/ops";

export const dynamic = "force-dynamic";

const types: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Uploads a dish photo to the public "menu" bucket and puts it on the dish. */
export async function POST(req: Request) {
  const me = await currentStaff(["manager"]);
  if (!me) return Response.json({ error: "Sign in again as the owner or a manager." }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const itemId = String(form?.get("itemId") ?? "");
  if (!(file instanceof File) || !/^[0-9a-f-]{36}$/.test(itemId)) return Response.json({ error: "Choose a photo." }, { status: 400 });
  const ext = types[file.type];
  if (!ext) return Response.json({ error: "Use a JPG, PNG or WebP photo." }, { status: 400 });
  if (file.size > 3 * 1024 * 1024) return Response.json({ error: "Photos must be under 3 MB." }, { status: 400 });
  const { data: owned } = await db().from("menu_items").select("id").eq("id", itemId).eq("restaurant_id", me.restaurant.id).maybeSingle();
  if (!owned) return Response.json({ error: "Dish not found." }, { status: 404 });
  const path = `${me.restaurant.id}/${itemId}-${Date.now()}.${ext}`;
  const { error } = await db().storage.from("menu").upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
  if (error) return Response.json({ error: "Upload failed. Try again." }, { status: 500 });
  const url = db().storage.from("menu").getPublicUrl(path).data.publicUrl;
  await db().from("menu_items").update({ image_url: url }).eq("id", itemId);
  return Response.json({ ok: true, url });
}
