// A full meal across four separate browsers, as four separate devices would be: the customer's
// phone, the cashier, the kitchen and the owner. Runs against the showcase restaurant and puts
// its UPI setting back afterwards. Usage: node tests/e2e.mjs [baseUrl]   (dev server running)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
import AxeBuilder from "../../../node_modules/@axe-core/playwright/dist/index.mjs";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const logins = readFileSync(new URL("../demo-logins.local.txt", import.meta.url), "utf8");
const ownerEmail = logins.match(/Email: (\S+)/)[1];
const ownerPass = logins.match(/Admin[\s\S]*?Password: (\S+)/)[1];
const kitchenPass = logins.match(/Kitchen \(\/kitchen\)[\s\S]*?Password: (\S+)/)[1];
const cashierPass = logins.match(/Cashier \(\/pos\)[\s\S]*?Password: (\S+)/)[1];
const base = process.argv[2] ?? "http://localhost:3106";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: r } = await db.from("restaurants").select("id, upi_vpa").eq("slug", "kaaram-kitchen").single();
const { data: table } = await db.from("dining_tables").select("id, qr_token, label").eq("restaurant_id", r.id).eq("label", "3").single();
// Start from a free table 3 and a UPI ID, so the customer can pay from the phone.
await db.from("table_sessions").update({ status: "closed", closed_at: new Date().toISOString() }).eq("table_id", table.id).neq("status", "closed");
await db.from("restaurants").update({ upi_vpa: "kaaramkitchen.test@okaxis", pay_at_table: true, confirm_first_order: true }).eq("id", r.id);

let failed = 0;
const ok = (c, m) => {
  console.log(`${c ? "PASS" : "FAIL"} ${m}`);
  if (!c) failed++;
};
const until = async (fn, ms = 12000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn().catch(() => false)) return true;
    await new Promise((res) => setTimeout(res, 300));
  }
  return false;
};
const browser = await chromium.launch({ channel: "chrome" });
const device = async (w, h) => (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
const phone = await device(390, 844);
const cashier = await device(1366, 860);
const kitchen = await device(1280, 800);
const owner = await device(1440, 900);
const errors = [];
for (const p of [phone, cashier, kitchen, owner]) p.on("pageerror", (e) => errors.push(e.message));

try {
  // Staff sign in on their own devices
  for (const [p, path, user, pass] of [
    [cashier, "/pos", "cashier", cashierPass],
    [kitchen, "/kitchen", "kitchen", kitchenPass],
  ]) {
    await p.goto(base + path, { waitUntil: "load" });
    await p.getByLabel("Restaurant code").fill("kaaram-kitchen");
    await p.getByLabel("Username").fill(user);
    await p.getByLabel("Password").fill(pass);
    await p.getByRole("button", { name: "Sign in" }).click();
  }
  ok(await until(() => cashier.getByRole("heading", { name: "Ground floor" }).isVisible()), "cashier: signs in, sees the floor");
  ok(await until(() => kitchen.getByText(/All caught up|KOT/).first().isVisible()), "kitchen: signs in, sees tickets");
  await kitchen.goto(base + "/pos", { waitUntil: "load" });
  ok(await until(() => kitchen.getByLabel("Restaurant code").isVisible()), "kitchen login can't open the cashier");
  await kitchen.goto(base + "/kitchen", { waitUntil: "load" });

  // Customer scans table 3
  await phone.goto(`${base}/order/${table.qr_token}`, { waitUntil: "load" });
  ok(await until(() => phone.getByRole("heading", { name: "Biryani" }).isVisible()), "phone: menu opens from the QR");
  await phone.getByRole("button", { name: "Add Chicken 65" }).last().click();
  await phone.getByRole("button", { name: "Add Chicken dum biryani" }).last().click();
  await phone.locator("label", { hasText: "Less spicy" }).click();
  await phone.getByRole("button", { name: /^Add, ₹/ }).click();
  await phone.getByRole("button", { name: /View order/ }).click();
  await phone.getByRole("button", { name: /Send to kitchen/ }).click();
  ok(await until(() => phone.getByText("Waiting for staff to confirm").first().isVisible()), "phone: first order waits for staff");

  // Cashier confirms it
  const card = cashier.locator("li").filter({ has: cashier.getByText("Table 3", { exact: true }) }).filter({ has: cashier.getByRole("button", { name: /Confirm, send to kitchen/ }) });
  ok(await until(() => card.isVisible(), 6000), "cashier: new QR order appears live");
  await card.getByRole("button", { name: /Confirm, send to kitchen/ }).click();
  ok(await until(() => phone.getByText("Sent to kitchen").first().isVisible()), "phone: sees it reach the kitchen");

  // Kitchen cooks it
  const ticket = kitchen.locator("ol > li").filter({ has: kitchen.getByText("Table 3", { exact: true }) });
  const t0 = Date.now();
  ok(await until(() => ticket.isVisible(), 6000), "kitchen: ticket arrives live");
  console.log("   ticket reached the kitchen in", Date.now() - t0, "ms");
  ok(await ticket.getByText("Less spicy").isVisible(), "kitchen: the customer's note is on the ticket");
  await ticket.getByRole("button", { name: "Start cooking" }).click();
  ok(await until(() => phone.getByText("Cooking").first().isVisible()), "phone: sees cooking");
  await ticket.getByRole("button", { name: "Ready at the pass" }).click();
  ok(await until(() => phone.getByText("Ready, coming to you").first().isVisible()), "phone: sees ready");

  // Cashier serves
  const pass = cashier.locator("section", { hasText: "Ready to serve" });
  await until(() => pass.getByRole("button", { name: "Served" }).first().isVisible());
  for (let i = 0; i < 4; i++) {
    const rows = pass.locator("li").filter({ has: cashier.getByText("3", { exact: true }) });
    if (!(await rows.count())) break;
    const before = await rows.count();
    await rows.first().getByRole("button", { name: "Served" }).click();
    await until(async () => (await rows.count()) < before, 5000);
  }
  ok(await until(() => phone.getByText("Served").first().isVisible()), "phone: sees served");

  // Customer asks for the bill, joins rewards, pays by UPI
  await phone.getByRole("button", { name: "Get the bill" }).click();
  ok(await until(() => phone.getByRole("heading", { name: /^Bill/ }).isVisible()), "phone: bill with GST");
  await phone.getByRole("button", { name: /Add your number/ }).click();
  await phone.getByLabel("Mobile number").fill("5550012345");
  await phone.getByLabel("First name (optional)").fill("Test");
  await phone.getByRole("button", { name: "Join" }).click();
  await until(() => phone.getByRole("button", { name: /^Pay ₹/ }).isVisible());
  await phone.getByRole("button", { name: /^Pay ₹/ }).click();
  const upi = phone.getByRole("link", { name: /with a UPI app/ });
  ok((await upi.getAttribute("href"))?.startsWith("upi://pay?pa=kaaramkitchen.test%40okaxis"), "phone: UPI link pays the restaurant's own UPI ID");
  await upi.evaluate((a) => a.addEventListener("click", (e) => e.preventDefault()));
  await upi.click();
  await phone.getByRole("button", { name: /paid ₹/ }).click();
  ok(await until(() => phone.getByText(/cashier is confirming/).isVisible()), "phone: payment waits for the cashier");

  // Cashier checks the money arrived
  const check = cashier.locator("section", { hasText: "Check these UPI payments" });
  ok(await until(() => check.isVisible()), "cashier: asked to check the UPI payment");
  await check.getByRole("button", { name: "Received" }).first().click();
  ok(await until(() => phone.getByText("Paid. Thank you!").isVisible()), "phone: paid once the cashier confirms");
  ok(await phone.getByText(/Stamp added|Card full/).isVisible(), "phone: loyalty stamp added");

  // Low feedback reaches the owner
  await phone.locator("fieldset", { hasText: "Food" }).locator("label").nth(1).click();
  await phone.locator("fieldset", { hasText: "Service" }).locator("label").nth(1).click();
  await phone.getByRole("button", { name: "Send feedback" }).click();
  ok(await until(() => phone.getByText(/Sorry it wasn/).isVisible()), "phone: low feedback goes to the manager");

  await owner.goto(base + "/admin", { waitUntil: "load" });
  await owner.getByLabel("Email").fill(ownerEmail);
  await owner.getByLabel("Password").fill(ownerPass);
  await owner.getByRole("button", { name: "Sign in" }).click();
  ok(await until(() => owner.getByRole("heading", { name: "Today", exact: true }).isVisible()), "owner: signs in");
  ok(await until(() => owner.getByText(/Table 3 paid/).first().isVisible()), "owner: today shows the payment");
  await owner.getByRole("button", { name: "Feedback", exact: true }).click();
  ok(await until(() => owner.getByText("Table 3, Test").first().isVisible()), "owner: sees the low feedback");

  // Sold out from the kitchen reaches the phone
  await kitchen.getByRole("button", { name: /^Sold out/ }).click();
  await kitchen.getByRole("dialog").getByRole("searchbox").fill("apollo");
  await kitchen.getByRole("dialog").getByRole("button", { name: "Sold out" }).click();
  await kitchen.keyboard.press("Escape");
  await phone.goto(`${base}/order/${table.qr_token}`, { waitUntil: "load" });
  ok(await until(() => phone.getByRole("button", { name: /^Apollo fish, .*sold out$/ }).isVisible()), "phone: sold-out dish greys out");
  await kitchen.getByRole("button", { name: /^Sold out/ }).click();
  await kitchen.getByRole("dialog").getByRole("searchbox").fill("apollo");
  await kitchen.getByRole("dialog").getByRole("button", { name: "Back on" }).click();
  await kitchen.keyboard.press("Escape");

  // Cashier frees the table
  await cashier.getByRole("button", { name: /^Table 3,/ }).click();
  await cashier.getByRole("button", { name: /Table cleared, free it/ }).click();
  ok(await until(() => cashier.getByRole("button", { name: "Table 3, Free" }).isVisible()), "cashier: table is free again");

  // Accessibility of each app
  for (const [p, name] of [
    [phone, "order"],
    [cashier, "pos"],
    [kitchen, "kitchen"],
    [owner, "admin"],
  ]) {
    const res = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).exclude("nextjs-portal").analyze();
    ok(res.violations.length === 0, `axe ${name}: ${res.violations.map((v) => `${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`).join("; ") || "clean"}`);
  }
} catch (e) {
  ok(false, `stopped: ${e.message.split("\n")[0]}`);
} finally {
  await db.from("restaurants").update({ upi_vpa: r.upi_vpa }).eq("id", r.id);
  // Leave the showcase restaurant as it was: remove the test guest and their feedback.
  await db.from("feedback").delete().eq("restaurant_id", r.id).eq("guest_name", "Test");
  const { data: tester } = await db.from("members").select("id").eq("restaurant_id", r.id).eq("phone", "+915550012345").maybeSingle();
  if (tester) {
    await db.from("table_sessions").update({ member_id: null }).eq("member_id", tester.id);
    await db.from("members").delete().eq("id", tester.id);
  }
  ok(errors.length === 0, `no page errors${errors.length ? ` (${errors[0]})` : ""}`);
  await browser.close();
  console.log(failed ? `\n${failed} failed` : "\nAll passed");
  process.exitCode = failed ? 1 : 0;
}
