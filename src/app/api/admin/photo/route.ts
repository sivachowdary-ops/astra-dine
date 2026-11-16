import { currentStaff } from "@/lib/auth";
import { db } from "@/lib/server/ops";

export const dynamic = "force-dynamic";

const types: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Uploads a dish photo, or the restaurant's cover or logo, to the public "menu" bucket. */
export async function POST(req: Request) {
  const me = await currentStaff(["manager"]);
  if (!me) return Response.json({ error: "Sign in again as the owner or a manager." }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const itemId = String(form?.get("itemId") ?? "");
  const brand = String(form?.get("brand") ?? "");
  const forBrand = brand === "cover" || brand === "logo";
  if (!(file instanceof File) || (!forBrand && !/^[0-9a-f-]{36}$/.test(itemId))) return Response.json({ error: "Choose a photo." }, { status: 400 });
  const ext = types[file.type];
  if (!ext) return Response.json({ error: "Use a JPG, PNG or WebP photo." }, { status: 400 });
  if (file.size > 3 * 1024 * 1024) return Response.json({ error: "Photos must be under 3 MB." }, { status: 400 });
  if (forBrand) {
    const path = `${me.restaurant.id}/${brand}-${Date.now()}.${ext}`;
    const { error } = await db().storage.from("menu").upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
    if (error) return Response.json({ error: "Upload failed. Try again." }, { status: 500 });
    const url = db().storage.from("menu").getPublicUrl(path).data.publicUrl;
    await db().from("restaurants").update(brand === "cover" ? { cover_url: url } : { logo_url: url }).eq("id", me.restaurant.id);
    return Response.json({ ok: true, url });
  }
  const { data: owned } = await db().from("menu_items").select("id").eq("id", itemId).eq("restaurant_id", me.restaurant.id).maybeSingle();
  if (!owned) return Response.json({ error: "Dish not found." }, { status: 404 });
  const path = `${me.restaurant.id}/${itemId}-${Date.now()}.${ext}`;
  const { error } = await db().storage.from("menu").upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
  if (error) return Response.json({ error: "Upload failed. Try again." }, { status: 500 });
  const url = db().storage.from("menu").getPublicUrl(path).data.publicUrl;
  await db().from("menu_items").update({ image_url: url }).eq("id", itemId);
  return Response.json({ ok: true, url });
}
