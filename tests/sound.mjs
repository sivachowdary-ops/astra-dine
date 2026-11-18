// Sound alerts: the kitchen chimes for a new ticket, the cashier for a table calling. The browser's
// sound engine is watched, so the test can count chimes without a speaker. Puts settings back.
// Usage: node tests/sound.mjs [baseUrl]   (dev server running)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "../../../node_modules/@playwright/test/index.mjs";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const logins = readFileSync(new URL("../demo-logins.local.txt", import.meta.url), "utf8");
const kitchenPass = logins.match(/Kitchen \(\/kitchen\)[\s\S]*?Password: (\S+)/)[1];
const cashierPass = logins.match(/Cashier \(\/pos\)[\s\S]*?Password: (\S+)/)[1];
const base = process.argv[2] ?? "http://localhost:3106";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let failed = 0;
const ok = (c, m) => {
  console.log(`${c ? "PASS" : "FAIL"} ${m}`);
  if (!c) failed++;
};
const until = async (fn, ms = 15000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn().catch(() => false)) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
};

const { data: r } = await db.from("restaurants").select("id, confirm_first_order").eq("slug", "kaaram-kitchen").single();
const { data: table } = await db.from("dining_tables").select("id, label, qr_token").eq("restaurant_id", r.id).eq("label", "12").single();
await db.from("table_sessions").update({ status: "closed", closed_at: new Date().toISOString() }).eq("table_id", table.id).neq("status", "closed");

const b = await chromium.launch({ channel: "chrome", args: ["--autoplay-policy=user-gesture-required"] });
const device = async () => {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  // Count every note the page plays.
  await ctx.addInitScript(() => {
    window.__notes = 0;
    const orig = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      window.__notes++;
      return orig.call(this);
    };
  });
  return ctx.newPage();
};
const signIn = async (p, path, user, pass) => {
  await p.goto(base + path, { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  await p.getByLabel("Restaurant code").fill("kaaram-kitchen");
  await p.getByLabel("Username").fill(user);
  await p.getByLabel("Password").fill(pass);
  await p.getByRole("button", { name: "Sign in" }).click();
};
const notes = (p) => p.evaluate(() => window.__notes);
try {
  const kitchen = await device();
  const cashier = await device();
  await signIn(kitchen, "/kitchen", "kitchen", kitchenPass);
  await signIn(cashier, "/pos", "cashier", cashierPass);
  for (const p of [kitchen, cashier]) await p.getByRole("button", { name: "Turn sound on" }).click({ timeout: 60000 });
  ok(await kitchen.getByRole("button", { name: "Sound on" }).isVisible(), "the kitchen's sound switch turns on");
  await kitchen.waitForTimeout(800);
  const k0 = await notes(kitchen);
  const c0 = await notes(cashier);
  ok(k0 >= 1 && c0 >= 1, "switching on plays a short test note");

  // A guest order that goes straight to the kitchen.
  await db.from("restaurants").update({ confirm_first_order: false }).eq("id", r.id);
  const menu = await fetch(`${base}/api/order/${table.qr_token}`).then((x) => x.json());
  const dish = menu.items.find((i) => i.name === "Chicken 65");
  await fetch(`${base}/api/order/${table.qr_token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "order", lines: [{ itemId: dish.id, qty: 1, addonIds: [] }] }) });
  ok(await until(async () => (await notes(kitchen)) >= k0 + 3), `the kitchen chimes for the new ticket (${(await notes(kitchen)) - k0} notes)`);
  ok(await until(async () => (await kitchen.title()).startsWith("(")), `the kitchen tab shows the waiting count: "${await kitchen.title()}"`);

  // The table calls for water.
  const c1 = await notes(cashier);
  await fetch(`${base}/api/order/${table.qr_token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "call", kind: "water" }) });
  ok(await until(async () => (await notes(cashier)) >= c1 + 2), `the cashier chimes when a table calls (${(await notes(cashier)) - c1} notes)`);
  ok(await until(async () => (await cashier.title()).startsWith("(")), `the cashier tab shows the count: "${await cashier.title()}"`);

  // After a reload the switch is remembered.
  await kitchen.reload({ waitUntil: "load" });
  ok(await until(() => kitchen.getByRole("button", { name: "Sound on" }).isVisible(), 30000), "the kitchen remembers sound is on after a reload");
} catch (e) {
  failed++;
  console.log("FAIL stopped:", e.message.split("\n")[0]);
} finally {
  await db.from("restaurants").update({ confirm_first_order: r.confirm_first_order }).eq("id", r.id);
  await db.from("calls").update({ resolved_at: new Date().toISOString() }).eq("table_id", table.id).is("resolved_at", null);
  await db.from("table_sessions").update({ status: "closed", closed_at: new Date().toISOString() }).eq("table_id", table.id).neq("status", "closed");
  await b.close();
}
console.log(failed ? `\n${failed} failed` : "\nAll passed");
process.exit(failed ? 1 : 0);
