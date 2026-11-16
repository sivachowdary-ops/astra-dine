// Puts a busy lunch on the floor (orders from five tables through the real guest API), then
// screenshots the kitchen and cashier screens. Closes those tables again at the end.
// Usage: node tests/staff-look.mjs [baseUrl]   (dev server running)
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
const keep = process.argv.includes("--keep");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: r } = await db.from("restaurants").select("id, confirm_first_order").eq("slug", "kaaram-kitchen").single();
const { data: tables } = await db.from("dining_tables").select("id, label, qr_token").eq("restaurant_id", r.id).in("label", ["2", "6", "9", "15", "21", "T3"]);
const byLabel = Object.fromEntries(tables.map((t) => [t.label, t]));
const busy = ["2", "6", "9", "15", "21"].filter((l) => byLabel[l]);
await db.from("table_sessions").update({ status: "closed", closed_at: new Date().toISOString() }).in("table_id", tables.map((t) => t.id)).neq("status", "closed");

const post = (token, body) => fetch(`${base}/api/order/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((x) => x.json());
const menu = await fetch(`${base}/api/order/${byLabel[busy[0]].qr_token}`).then((x) => x.json());
const id = (name) => menu.items.find((i) => i.name === name)?.id;
const orders = [
  [{ itemId: id("Chicken 65"), qty: 1 }, { itemId: id("Chicken dum biryani"), qty: 2, note: "Less spicy" }, { itemId: id("Sweet lassi"), qty: 2 }],
  [{ itemId: id("Andhra veg meals"), qty: 3 }, { itemId: id("Apollo fish"), qty: 1 }],
  [{ itemId: id("Gongura mutton"), qty: 1 }, { itemId: id("Butter naan"), qty: 4 }, { itemId: id("Paneer biryani"), qty: 1 }],
  [{ itemId: id("Kodi vepudu"), qty: 1 }, { itemId: id("Family pack chicken biryani"), qty: 1 }],
];
await db.from("restaurants").update({ confirm_first_order: false }).eq("id", r.id);
for (const [i, lines] of orders.entries()) {
  const out = await post(byLabel[busy[i]].qr_token, { type: "order", lines: lines.filter((l) => l.itemId) });
  if (out.error) console.log("order", busy[i], out.error);
}
await db.from("restaurants").update({ confirm_first_order: true }).eq("id", r.id);
// One brand-new table waiting for the cashier, one asking for the bill, one calling for water.
if (busy[4]) await post(byLabel[busy[4]].qr_token, { type: "order", lines: [{ itemId: id("Chilli chicken, dry"), qty: 1, addonIds: [] }] });
await post(byLabel[busy[3]].qr_token, { type: "bill" });
await post(byLabel[busy[1]].qr_token, { type: "call", kind: "water" });
// Start a couple of lines cooking so the kitchen shows every state.
const { data: lines } = await db.from("order_lines").select("id, status, session_id").eq("restaurant_id", r.id).eq("status", "queued").limit(3);
if (lines?.length) await db.from("order_lines").update({ status: "cooking" }).in("id", lines.slice(0, 2).map((l) => l.id));

const b = await chromium.launch({ channel: "chrome" });
const shot = async (path, user, pass, w, h, name) => {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1.5 })).newPage();
  await p.goto(base + path, { waitUntil: "load" });
  await p.getByLabel("Restaurant code").fill("kaaram-kitchen");
  await p.getByLabel("Username").fill(user);
  await p.getByLabel("Password").fill(pass);
  await p.getByRole("button", { name: "Sign in" }).click();
  await p.waitForTimeout(5000);
  await p.screenshot({ path: `test-results/${name}.png` });
  return p;
};
const k = await shot("/kitchen", "kitchen", kitchenPass, 1280, 800, "s-kitchen");
const c = await shot("/pos", "cashier", cashierPass, 1366, 860, "s-pos");
const t = c.getByRole("button", { name: /Table 2\b/ }).first();
if (await t.count()) {
  await t.click();
  await c.waitForTimeout(1500);
  await c.screenshot({ path: "test-results/s-pos-table.png" });
}
await k.close();
await b.close();
if (!keep) {
  await db.from("calls").update({ resolved_at: new Date().toISOString() }).in("table_id", tables.map((x) => x.id)).is("resolved_at", null);
  await db.from("table_sessions").update({ status: "closed", closed_at: new Date().toISOString() }).in("table_id", tables.map((x) => x.id)).neq("status", "closed");
}
console.log("done", keep ? "(tables left open)" : "(tables closed again)");
