// "Try the whole restaurant yourself": a private copy opens on the laptop as the owner; QR links
// sign a tablet in as the kitchen and another device as the cashier; a guest orders at table 5
// and the order travels through the cashier to the kitchen. The copy is deleted afterwards.
// Usage: node tests/trial.mjs [baseUrl]   (dev server running)
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
const ctx = (w, h) => b.newContext({ viewport: { width: w, height: h } });
const laptopCtx = await ctx(1440, 900);
const laptop = await laptopCtx.newPage();
const errors = [];
laptop.on("pageerror", (e) => errors.push(e.message));
let rid = null;
try {
  const t0 = Date.now();
  const res = await laptop.request.post(base + "/api/trial");
  ok(res.ok(), `a private copy is made (${Date.now() - t0} ms)`);
  const { data: r } = await db.from("restaurants").select("id, slug, expires_at").like("slug", "try-%").order("created_at", { ascending: false }).limit(1).single();
  rid = r.id;
  const counts = {};
  for (const t of ["menu_items", "dining_tables", "members", "table_sessions", "order_lines", "staff"]) counts[t] = (await db.from(t).select(t === "staff" ? "user_id" : "id", { count: "exact", head: true }).eq("restaurant_id", rid)).count;
  ok(counts.menu_items >= 40 && counts.dining_tables === 32 && counts.table_sessions > 500 && counts.staff === 3, `it has the menu, tables and history: ${JSON.stringify(counts)}`);

  await laptop.goto(base + "/admin", { waitUntil: "load" });
  ok(await until(() => laptop.getByText(/every screen is yours to try/).isVisible(), 60000), "the owner dashboard opens on the laptop with the 'every screen' panel");
  await laptop.waitForTimeout(2000);
  await laptop.screenshot({ path: "test-results/trial-owner.png" });
  const axe = await new AxeBuilder({ page: laptop }).analyze();
  ok(axe.violations.length === 0, `axe owner dashboard: ${axe.violations.map((v) => `${v.id} (${v.nodes.length})`).join(", ") || "clean"}`);

  // QR links for the kitchen and the cashier, each on its own device.
  const link = async (title) => {
    await laptop.getByRole("listitem").filter({ hasText: title }).getByRole("button", { name: "On another device" }).click();
    const url = (await laptop.getByRole("dialog").locator("p.break-all").textContent({ timeout: 20000 }))?.trim();
    await laptop.keyboard.press("Escape");
    return url;
  };
  const kitchenUrl = await link("Kitchen screen");
  const cashierUrl = await link("Cashier");
  const kitchen = await (await ctx(1280, 800)).newPage();
  const cashier = await (await ctx(1366, 860)).newPage();
  await kitchen.goto(kitchenUrl, { waitUntil: "load" });
  await cashier.goto(cashierUrl, { waitUntil: "load" });
  ok(await until(() => kitchen.getByText("Kitchen, signed in as Kitchen screen").isVisible(), 60000), "the kitchen QR opens the kitchen screen, signed in");
  ok(await until(() => cashier.getByText(/Cashier, Front counter/).isVisible(), 60000), "the cashier QR opens the cashier, signed in");
  const again = await (await ctx(1280, 800)).newPage();
  await again.goto(kitchenUrl, { waitUntil: "load" });
  ok(await until(() => again.getByText("That QR code was already used").isVisible()), "a QR link works only once");

  // A guest orders at table 5; the cashier confirms; the kitchen gets the ticket.
  const { data: table } = await db.from("dining_tables").select("qr_token").eq("restaurant_id", rid).eq("label", "5").single();
  const phone = await (await ctx(390, 844)).newPage();
  await phone.goto(`${base}/order/${table.qr_token}`, { waitUntil: "load" });
  await phone.getByRole("heading", { name: "Most loved here" }).waitFor({ timeout: 60000 });
  await phone.getByRole("button", { name: /^Add Chicken 65$/ }).last().click();
  await phone.getByRole("button", { name: /View order/ }).click();
  await phone.getByRole("button", { name: /Send to kitchen/ }).click();
  const card = cashier.locator("li").filter({ has: cashier.getByText("Table 5", { exact: true }) }).filter({ has: cashier.getByRole("button", { name: /Confirm, send to kitchen/ }) });
  ok(await until(() => card.isVisible(), 20000), "the guest's order reaches the cashier live");
  await card.getByRole("button", { name: /Confirm, send to kitchen/ }).click();
  const ticket = kitchen.locator("ol > li").filter({ has: kitchen.getByText("Table 5", { exact: true }) });
  ok(await until(() => ticket.isVisible(), 20000), "the kitchen gets the ticket");
  await kitchen.screenshot({ path: "test-results/trial-kitchen.png" });

  // Pretend guests: the heartbeat seats another table.
  await laptop.request.post(base + "/api/trial/pulse");
  const { count: busy } = await db.from("table_sessions").select("id", { count: "exact", head: true }).eq("restaurant_id", rid).neq("status", "closed");
  ok(busy >= 2, `pretend guests keep the place busy (${busy} tables open)`);
  const { count: showcaseTouched } = await db.from("table_sessions").select("id", { count: "exact", head: true }).eq("restaurant_id", rid).eq("restaurant_id", "00000000-0000-0000-0000-000000000000");
  ok(showcaseTouched === 0, "the copy is separate from the sample restaurant");
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
