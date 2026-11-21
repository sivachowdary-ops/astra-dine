import { z } from "zod";
import { currentStaff } from "@/lib/auth";
import { staffEmail } from "@/lib/rules";
import { importSampleMenu } from "@/lib/server/menu-import";
import { OpError, db } from "@/lib/server/ops";

export const dynamic = "force-dynamic";

const uuid = z.string().uuid();
const option = z.object({ id: z.string().min(1).max(20), label: z.string().trim().min(1).max(40), price: z.number().int().min(0).max(100_000) });
const item = z.object({
  id: uuid.optional(),
  category_id: uuid,
  name: z.string().trim().min(1).max(80),
  local_name: z.string().trim().max(60).nullish(),
  description: z.string().trim().max(300).nullish(),
  price: z.number().int().min(0).max(100_000),
  diet: z.enum(["veg", "egg", "nonveg"]),
  spice: z.number().int().min(0).max(3),
  station: z.string().trim().min(1).max(20),
  prep_minutes: z.number().int().min(1).max(120),
  tags: z.array(z.enum(["bestseller", "chef", "new"])).max(3),
  variants: z.array(option).max(6),
  addons: z.array(option).max(10),
  serves: z.number().int().min(1).max(20).nullish(),
  available: z.boolean(),
});

const action = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("settings"),
    name: z.string().trim().min(2).max(60),
    place: z.string().trim().max(80).nullish(),
    gstin: z.string().trim().max(20).nullish(),
    gst_pct: z.number().min(0).max(28),
    upi_vpa: z.string().trim().regex(/^[\w.-]{2,64}@[a-zA-Z]{2,32}$/).or(z.literal("")).nullish(),
    upi_name: z.string().trim().max(60).nullish(),
    confirm_first_order: z.boolean(),
    pay_at_table: z.boolean(),
    stamps_for_reward: z.number().int().min(2).max(20),
    stamp_min_bill: z.number().int().min(0).max(100_000),
    reward_text: z.string().trim().min(2).max(60),
    reward_value: z.number().int().min(0).max(10_000),
    google_review_url: z.string().trim().url().max(300).or(z.literal("")).nullish(),
    tagline: z.string().trim().max(60).nullish(),
    offer_title: z.string().trim().max(40).nullish(),
    offer_text: z.string().trim().max(160).nullish(),
  }),
  z.object({
    type: z.literal("category"),
    id: uuid.optional(),
    name: z.string().trim().min(1).max(40),
    note: z.string().trim().max(60).nullish(),
    sort: z.number().int().optional(),
    // "HH:MM" in India time; both null means served all day.
    hours: z.object({ from: z.string().regex(/^\d{2}:\d{2}$/).nullable(), to: z.string().regex(/^\d{2}:\d{2}$/).nullable() }).optional(),
  }),
  z.object({ type: z.literal("deleteCategory"), id: uuid }),
  z.object({ type: z.literal("item"), item }),
  z.object({ type: z.literal("deleteItem"), id: uuid }),
  z.object({ type: z.literal("sampleMenu") }),
  z.object({ type: z.literal("table"), id: uuid.optional(), label: z.string().trim().min(1).max(10), area: z.string().trim().min(1).max(40), seats: z.number().int().min(1).max(30) }),
  z.object({ type: z.literal("addTables"), from: z.number().int().min(1).max(500), count: z.number().int().min(1).max(100), area: z.string().trim().min(1).max(40), seats: z.number().int().min(1).max(30) }),
  z.object({ type: z.literal("deleteTable"), id: uuid }),
  z.object({ type: z.literal("newQr"), id: uuid }),
  z.object({ type: z.literal("staff"), name: z.string().trim().min(1).max(60), username: z.string().trim().regex(/^[a-z0-9._-]{3,24}$/i), role: z.enum(["manager", "cashier", "kitchen"]), password: z.string().min(6).max(72) }),
  z.object({ type: z.literal("staffUpdate"), userId: uuid, active: z.boolean().optional(), password: z.string().min(6).max(72).optional(), role: z.enum(["manager", "cashier", "kitchen"]).optional() }),
  z.object({ type: z.literal("feedbackHandled"), id: uuid }),
  z.object({ type: z.literal("memberOffersOff"), id: uuid }),
  z.object({ type: z.literal("deleteMember"), id: uuid }),
  z.object({ type: z.literal("campaign"), name: z.string().trim().min(1).max(80), segment: z.string().max(40), message: z.string().trim().min(1).max(600), recipients: z.number().int().min(0).max(1_000_000) }),
]);

export async function POST(req: Request) {
  const parsed = action.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the details and try again." }, { status: 400 });
  const me = await currentStaff(["manager"]);
  if (!me) return Response.json({ error: "Sign in again as the owner or a manager." }, { status: 401 });
  const { restaurant: r, staff } = me;
  const a = parsed.data;
  const own = <T extends { eq: (c: string, v: string) => T }>(q: T) => q.eq("restaurant_id", r.id);
  try {
    switch (a.type) {
      case "settings": {
        const { type: _t, ...rest } = a;
        void _t;
        await db()
          .from("restaurants")
          .update({ ...rest, upi_vpa: rest.upi_vpa || null, google_review_url: rest.google_review_url || null, tagline: rest.tagline || null, offer_title: rest.offer_title || null, offer_text: rest.offer_text || null })
          .eq("id", r.id);
        break;
      }
      case "category":
        if (a.id) {
          if (a.hours && Boolean(a.hours.from) !== Boolean(a.hours.to)) throw new OpError("Set both a start and an end time, or neither.");
          if (a.hours?.from && a.hours.from === a.hours.to) throw new OpError("The start and end times are the same.");
          await own(
            db()
              .from("categories")
              .update({
                name: a.name,
                note: a.note ?? null,
                ...(a.sort !== undefined ? { sort: a.sort } : {}),
                ...(a.hours ? { available_from: a.hours.from, available_to: a.hours.to } : {}),
              })
              .eq("id", a.id),
          );
        }
        else {
          const { count } = await db().from("categories").select("id", { count: "exact", head: true }).eq("restaurant_id", r.id);
          await db().from("categories").insert({ restaurant_id: r.id, name: a.name, note: a.note ?? null, sort: count ?? 0 });
        }
        break;
      case "deleteCategory": {
        const { count } = await db().from("menu_items").select("id", { count: "exact", head: true }).eq("category_id", a.id);
        if (count) throw new OpError("Move or delete the dishes in this category first.");
        await own(db().from("categories").delete().eq("id", a.id));
        break;
      }
      case "item": {
        const { data: cat } = await db().from("categories").select("id").eq("id", a.item.category_id).eq("restaurant_id", r.id).maybeSingle();
        if (!cat) throw new OpError("Pick a category.");
        const { id, ...fields } = a.item;
        if (id) await own(db().from("menu_items").update(fields).eq("id", id));
        else {
          const { count } = await db().from("menu_items").select("id", { count: "exact", head: true }).eq("category_id", fields.category_id);
          const { data } = await db().from("menu_items").insert({ ...fields, restaurant_id: r.id, sort: count ?? 0 }).select("id").single<{ id: string }>();
          return Response.json({ ok: true, id: data?.id });
        }
        break;
      }
      case "deleteItem":
        await own(db().from("menu_items").delete().eq("id", a.id));
        break;
      case "sampleMenu":
        await importSampleMenu(r.id);
        break;
      case "table":
        if (a.id) await own(db().from("dining_tables").update({ label: a.label, area: a.area, seats: a.seats }).eq("id", a.id));
        else await db().from("dining_tables").insert({ restaurant_id: r.id, label: a.label, area: a.area, seats: a.seats });
        break;
      case "addTables": {
        const { data: existing } = await db().from("dining_tables").select("label").eq("restaurant_id", r.id);
        const taken = new Set((existing ?? []).map((t: { label: string }) => t.label));
        const rows = Array.from({ length: a.count }, (_, i) => String(a.from + i))
          .filter((label) => !taken.has(label))
          .map((label, i) => ({ restaurant_id: r.id, label, area: a.area, seats: a.seats, sort: a.from + i }));
        if (rows.length) await db().from("dining_tables").insert(rows);
        break;
      }
      case "deleteTable": {
        const { count } = await db().from("table_sessions").select("id", { count: "exact", head: true }).eq("table_id", a.id).neq("status", "closed");
        if (count) throw new OpError("This table has guests right now.");
        await own(db().from("dining_tables").delete().eq("id", a.id));
        break;
      }
      case "newQr": {
        const token = Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => b.toString(16).padStart(2, "0")).join("");
        await own(db().from("dining_tables").update({ qr_token: token }).eq("id", a.id));
        break;
      }
      case "staff": {
        const username = a.username.toLowerCase();
        const { data: user, error } = await db().auth.admin.createUser({ email: staffEmail(r.slug, username), password: a.password, email_confirm: true, user_metadata: { name: a.name } });
        if (error || !user.user) throw new OpError(/already|exists|registered/i.test(error?.message ?? "") ? "That username is taken here." : "Couldn't create the login.");
        await db().from("staff").insert({ user_id: user.user.id, restaurant_id: r.id, name: a.name, username, role: a.role });
        break;
      }
      case "staffUpdate": {
        const { data: target } = await db().from("staff").select("role").eq("user_id", a.userId).eq("restaurant_id", r.id).maybeSingle<{ role: string }>();
        if (!target) throw new OpError("Staff member not found.");
        if (target.role === "owner" && a.userId !== staff.user_id) throw new OpError("Only the owner can change the owner's login.");
        if (a.password) await db().auth.admin.updateUserById(a.userId, { password: a.password });
        const patch: Record<string, unknown> = {};
        if (a.active !== undefined && target.role !== "owner") patch.active = a.active;
        if (a.role && target.role !== "owner") patch.role = a.role;
        if (Object.keys(patch).length) await db().from("staff").update(patch).eq("user_id", a.userId);
        break;
      }
      case "feedbackHandled":
        await own(db().from("feedback").update({ handled: true }).eq("id", a.id));
        break;
      case "memberOffersOff":
        await own(db().from("members").update({ opt_in: false }).eq("id", a.id));
        break;
      case "deleteMember": {
        // A guest asked to be forgotten: unlink their past visits (bills stay, without the name
        // or number), then delete the card with their phone number, name and birthday.
        const { data: m } = await db().from("members").select("id").eq("id", a.id).eq("restaurant_id", r.id).maybeSingle();
        if (!m) throw new OpError("Member not found.");
        const { data: visits } = await db().from("table_sessions").select("id").eq("restaurant_id", r.id).eq("member_id", a.id);
        const ids = ((visits ?? []) as { id: string }[]).map((v) => v.id);
        if (ids.length) await db().from("feedback").update({ guest_name: null }).eq("restaurant_id", r.id).in("session_id", ids);
        await db().from("table_sessions").update({ member_id: null }).eq("restaurant_id", r.id).eq("member_id", a.id);
        await db().from("members").delete().eq("restaurant_id", r.id).eq("id", a.id);
        break;
      }
      case "campaign":
        await db().from("campaigns").insert({ restaurant_id: r.id, name: a.name, segment: a.segment, message: a.message, recipients: a.recipients });
        break;
    }
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof OpError) return Response.json({ error: e.message }, { status: 409 });
    console.error("[admin] failed:", (e as Error).message);
    return Response.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
