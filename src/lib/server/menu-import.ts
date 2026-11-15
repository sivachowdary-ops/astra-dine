import "server-only";
import { sampleCategories, sampleItems } from "../sample-menu";
import { db } from "./ops";

/** Loads the starter menu into a restaurant. Existing dishes are kept. */
export async function importSampleMenu(restaurantId: string) {
  const { data: existing } = await db().from("categories").select("id, name").eq("restaurant_id", restaurantId);
  const byName = new Map((existing ?? []).map((c: { id: string; name: string }) => [c.name, c.id]));
  const ids: Record<string, string> = {};
  for (const [i, c] of sampleCategories.entries()) {
    let id = byName.get(c.name);
    if (!id) {
      const { data } = await db().from("categories").insert({ restaurant_id: restaurantId, name: c.name, note: c.note ?? null, sort: i }).select("id").single<{ id: string }>();
      id = data?.id;
    }
    if (id) ids[c.id] = id;
  }
  const rows = sampleItems.map((m, i) => ({
    restaurant_id: restaurantId,
    category_id: ids[m.category]!,
    name: m.name,
    local_name: m.local ?? null,
    description: m.desc,
    price: m.price,
    diet: m.diet,
    spice: m.spice,
    station: m.station,
    prep_minutes: m.prep,
    tags: m.tags,
    variants: m.variants ?? [],
    addons: m.addons ?? [],
    serves: m.serves ?? null,
    sort: i,
  }));
  await db().from("menu_items").insert(rows);
}
