// Gives the showcase restaurant its look: uploads the dish photos, cover and logo to Supabase
// Storage (as an owner would from the admin dashboard) and sets the offer banner and the
// serving hours for Tiffins and Andhra meals. Safe to run again.
// Usage: node scripts/showcase-media.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { sampleItems } from "../src/lib/sample-menu.ts";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: r } = await db.from("restaurants").select("id").eq("slug", "kaaram-kitchen").single();
if (!r) throw new Error("Run npm run db:seed first.");

const dir = new URL("./showcase-photos/", import.meta.url);
async function upload(name, type) {
  const path = `${r.id}/showcase/${name}`;
  const { error } = await db.storage.from("menu").upload(path, readFileSync(new URL(name, dir)), { contentType: type, upsert: true });
  if (error) throw error;
  return db.storage.from("menu").getPublicUrl(path).data.publicUrl;
}

const photos = JSON.parse(readFileSync(new URL("./showcase-photos.json", import.meta.url), "utf8"));
let n = 0;
for (const item of sampleItems) {
  if (!photos[item.id]) continue;
  const url = await upload(`${item.id}.webp`, "image/webp");
  await db.from("menu_items").update({ image_url: url }).eq("restaurant_id", r.id).eq("name", item.name);
  n++;
}
await db
  .from("restaurants")
  .update({
    cover_url: await upload("_cover.webp", "image/webp"),
    logo_url: await upload("_logo.svg", "image/svg+xml"),
    tagline: "Andhra home food, fired up",
    offer_title: "Weekday lunch",
    offer_text: "Andhra meals with a free spiced majjiga, Monday to Friday, 12 to 4 pm.",
  })
  .eq("id", r.id);
await db.from("categories").update({ available_from: "07:00", available_to: "11:30", note: null }).eq("restaurant_id", r.id).eq("name", "Tiffins");
await db.from("categories").update({ available_from: "12:00", available_to: "16:00", note: null }).eq("restaurant_id", r.id).eq("name", "Andhra meals");
console.log(`Kaaram Kitchen: ${n} dish photos, cover, logo, offer and serving hours set.`);

// Public "try it" tables for the sales page. A simulated crew serves them (src/lib/server/showcase.ts).
for (let i = 1; i <= 6; i++) {
  const label = `T${i}`;
  const { data: has } = await db.from("dining_tables").select("id").eq("restaurant_id", r.id).eq("label", label).maybeSingle();
  if (!has) await db.from("dining_tables").insert({ restaurant_id: r.id, label, area: "Try it", seats: 4, sort: 100 + i });
}
console.log("Try-it tables T1 to T6 ready.");
