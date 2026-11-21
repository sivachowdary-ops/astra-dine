// Privacy: the policy page, its links, and the owner's "Stop offers" and "Delete" buttons on a
// private trial copy (the sample restaurant is never touched). The copy is deleted afterwards.
// Usage: node tests/privacy.mjs [baseUrl]   (dev server running)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
import AxeBuilder from "../../../node_modules/@axe-core/playwright/dist/index.mjs";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const base = process.argv[2] ?? "http://localhost:3106";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let failed = 0;
const ok = (c, m) => {
  console.log(`${c ? "PASS" : "FAIL"} ${m}`);
  if (!c) failed++;
};
const until = async (fn, ms = 20000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn().catch(() => false)) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
};
const b = await chromium.launch({ channel: "chrome" });
const errors = [];
let rid = null;
try {
  for (const [name, viewport] of [["phone", { width: 390, height: 844 }], ["laptop", { width: 1440, height: 900 }]]) {
    const p = await (await b.newContext({ viewport })).newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    const res = await p.goto(base + "/privacy", { waitUntil: "load" });
    ok(res?.ok() && (await p.getByRole("heading", { level: 1, name: "Privacy" }).isVisible()), `${name}: privacy page opens`);
    const axe = await new AxeBuilder({ page: p }).analyze();
    ok(axe.violations.length === 0, `${name}: axe privacy ${axe.violations.map((v) => `${v.id} (${v.nodes.length})`).join(", ") || "clean"}`);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(over <= 0, `${name}: no sideways scroll`);
    await p.screenshot({ path: `test-results/privacy-${name}.png`, fullPage: true });
    await p.context().close();
  }

  const laptop = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  laptop.on("pageerror", (e) => errors.push(e.message));
  await laptop.goto(base + "/", { waitUntil: "load" });
  ok((await laptop.locator("footer a[href='/privacy']").count()) === 1, "sales page footer links to the policy");

  const made = await laptop.request.post(base + "/api/trial");
  ok(made.ok(), "a private copy is made");
  const { data: r } = await db.from("restaurants").select("id").like("slug", "try-%").order("created_at", { ascending: false }).limit(1).single();
  rid = r.id;

  // A member who gets offers and has past visits and feedback.
  const { data: visited } = await db.from("table_sessions").select("member_id").eq("restaurant_id", rid).not("member_id", "is", null).limit(400);
  const ids = [...new Set((visited ?? []).map((v) => v.member_id))];
  const { data: member } = await db.from("members").select("id, name, phone").eq("restaurant_id", rid).eq("opt_in", true).in("id", ids).limit(1).single();
  ok(Boolean(member), "found a member with offers on and past visits");

  await laptop.goto(base + "/admin", { waitUntil: "load" });
  await until(() => laptop.getByText(/every screen is yours to try/).isVisible(), 60000);
  await laptop.getByRole("button", { name: "Loyalty" }).or(laptop.getByRole("link", { name: "Loyalty" })).first().click();
  const search = laptop.getByRole("searchbox", { name: "Search members" });
  await search.waitFor({ timeout: 20000 });
  await search.fill(member.phone);
  const label = member.name ?? member.phone;
  await laptop.getByRole("button", { name: `Stop offers for ${label}` }).click();
  ok(await until(async () => (await db.from("members").select("opt_in").eq("id", member.id).single()).data?.opt_in === false), "Stop offers switches the member's offers off");
  ok(await until(() => laptop.getByRole("status").filter({ hasText: "Offers stopped" }).isVisible()), "the owner sees it was done");

  laptop.once("dialog", (d) => void d.accept());
  await laptop.getByRole("button", { name: `Delete ${label} and their details` }).click();
  ok(await until(async () => !(await db.from("members").select("id").eq("id", member.id).maybeSingle()).data), "Delete removes the member's card, number and name");
  const { count: linked } = await db.from("table_sessions").select("id", { count: "exact", head: true }).eq("member_id", member.id);
  ok(linked === 0, "past visits are kept, without the member");
  const { count: bills } = await db.from("table_sessions").select("id", { count: "exact", head: true }).eq("restaurant_id", rid);
  ok(bills > 500, "the restaurant's bills are still there");
  ok(await until(() => laptop.getByText("Nobody matches.").isVisible()), "the member is gone from the list");
  const axe = await new AxeBuilder({ page: laptop }).analyze();
  ok(axe.violations.length === 0, `axe loyalty: ${axe.violations.map((v) => `${v.id} (${v.nodes.length})`).join(", ") || "clean"}`);
  await laptop.screenshot({ path: "test-results/privacy-loyalty.png" });

  // Another restaurant's owner can't delete this restaurant's members.
  const { data: other } = await db.from("members").select("id").neq("restaurant_id", rid).limit(1).single();
  const res = await laptop.request.post(base + "/api/admin", { data: { type: "deleteMember", id: other.id } });
  const still = (await db.from("members").select("id").eq("id", other.id).maybeSingle()).data;
  ok(!res.ok() && Boolean(still), "a member of another restaurant can't be deleted");
  ok(errors.length === 0, `no page errors${errors.length ? `: ${errors[0]}` : ""}`);
} catch (e) {
  failed++;
  console.log("FAIL stopped:", e.message.split("\n")[0]);
} finally {
  if (rid) {
    const { data: staff } = await db.from("staff").select("user_id").eq("restaurant_id", rid);
    await db.from("restaurants").delete().eq("id", rid);
    for (const s of staff ?? []) await db.auth.admin.deleteUser(s.user_id);
    console.log("   copy deleted");
  }
  await b.close();
}
console.log(failed ? `\n${failed} failed` : "\nAll passed");
process.exit(failed ? 1 : 0);
