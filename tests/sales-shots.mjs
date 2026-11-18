// Real screens for the sales page, captured from a private trial copy (the sample restaurant is
// not touched): a guest's bill, the paid screen with the stamp card, the review ask, and a
// kitchen ticket with a note. Saves WebP images to public/showcase/. Deletes the copy after.
// Usage: node tests/sales-shots.mjs [baseUrl]   (dev server running)
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "../../../node_modules/@playwright/test/index.mjs";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const sharp = createRequire(import.meta.url)("../../../node_modules/sharp");
const base = process.argv[2] ?? "http://localhost:3106";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const until = async (fn, ms = 30000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn().catch(() => false)) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
};
const save = async (page, name, width) => {
  const png = await page.screenshot();
  await sharp(png).resize({ width }).webp({ quality: 82 }).toFile(`public/showcase/${name}.webp`);
  console.log("saved", name);
};

const b = await chromium.launch({ channel: "chrome" });
const owner = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
let rid = null;
try {
  await owner.request.post(base + "/api/trial");
  const { data: r } = await db.from("restaurants").select("id").like("slug", "try-%").order("created_at", { ascending: false }).limit(1).single();
  rid = r.id;
  await db.from("restaurants").update({ upi_vpa: "kaaramkitchen.test@okaxis", confirm_first_order: false }).eq("id", rid);
  const { data: table } = await db.from("dining_tables").select("qr_token").eq("restaurant_id", rid).eq("label", "7").single();

  // Kitchen screen, signed in through its own one-time link.
  await owner.goto(base + "/admin", { waitUntil: "load" });
  await owner.getByText(/every screen is yours to try/).waitFor({ timeout: 60000 });
  const linkFor = async (title) => {
    await owner.getByRole("listitem").filter({ hasText: title }).getByRole("button", { name: "On another device" }).click();
    const url = (await owner.getByRole("dialog").locator("p.break-all").textContent({ timeout: 20000 })).trim();
    await owner.keyboard.press("Escape");
    return url;
  };
  const kitchen = await (await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 })).newPage();
  await kitchen.goto(await linkFor("Kitchen screen"), { waitUntil: "load" });
  const cashier = await (await b.newContext({ viewport: { width: 1366, height: 860 } })).newPage();
  await cashier.goto(await linkFor("Cashier"), { waitUntil: "load" });

  // The guest at table 7 orders: biryani less spicy, Chicken 65, a lassi.
  const phone = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  await phone.goto(`${base}/order/${table.qr_token}`, { waitUntil: "load" });
  await phone.getByRole("heading", { name: "Most loved here" }).waitFor({ timeout: 60000 });
  await phone.getByRole("button", { name: /^Add Chicken 65$/ }).last().click();
  await phone.getByRole("button", { name: /^Add Chicken dum biryani$/ }).last().click();
  await phone.locator("label", { hasText: "Less spicy" }).click();
  await phone.getByRole("button", { name: /^Add, ₹/ }).click();
  await phone.getByRole("button", { name: /^Add Mango lassi$/ }).last().click().catch(() => {});
  await phone.getByRole("button", { name: /View order/ }).click();
  await phone.getByRole("button", { name: /Send to kitchen/ }).click();
  await until(() => kitchen.getByText("Less spicy").first().isVisible());
  await kitchen.waitForTimeout(1500);
  await save(kitchen, "kitchen-ticket", 1600);

  // Served, then the bill on the guest's phone.
  const { data: ses } = await db.from("table_sessions").select("id").eq("restaurant_id", rid).eq("status", "seated").order("opened_at", { ascending: false }).limit(1).single();
  const now = new Date().toISOString();
  await db.from("order_lines").update({ status: "served", ready_at: now, served_at: now }).eq("session_id", ses.id);
  await phone.waitForTimeout(5000);
  await phone.getByRole("button", { name: "Get the bill" }).click();
  await phone.getByRole("button", { name: /Add your number/ }).click();
  await phone.getByLabel("Mobile number").fill("5550012345");
  await phone.getByLabel("First name (optional)").fill("Lakshmi");
  await phone.getByRole("button", { name: "Join" }).click();
  await until(() => phone.getByRole("heading", { name: "Join rewards" }).count().then((n) => n === 0));
  await until(() => phone.getByRole("button", { name: /^Pay ₹/ }).isVisible());
  await phone.waitForTimeout(4500); // let the "you're in" message fade
  await phone.getByRole("heading", { name: /^Bill/ }).scrollIntoViewIfNeeded();
  await phone.evaluate(() => window.scrollBy(0, -140));
  await phone.waitForTimeout(800);
  await save(phone, "phone-bill", 780);

  // Pays by UPI; the cashier confirms it arrived.
  await phone.getByRole("button", { name: /^Pay ₹/ }).click();
  const upi = phone.getByRole("link", { name: /with a UPI app/ });
  await upi.evaluate((a) => a.addEventListener("click", (e) => e.preventDefault()));
  await upi.click();
  await phone.getByRole("button", { name: /paid ₹/ }).click();
  const check = cashier.locator("section", { hasText: "Check these UPI payments" });
  await until(() => check.isVisible());
  await cashier.waitForTimeout(800);
  await save(cashier, "cashier-check", 1600);
  await check.getByRole("button", { name: "Received" }).first().click();
  await until(() => phone.getByText("Paid. Thank you!").isVisible());
  await phone.waitForTimeout(800);
  await save(phone, "phone-paid", 780);

  // Five stars: the guest is invited (no reward) to leave a Google review.
  await db.from("restaurants").update({ google_review_url: "https://g.page/r/sample-review-link" }).eq("id", rid);
  await phone.locator("fieldset", { hasText: "Food" }).locator("label").nth(4).click();
  await phone.locator("fieldset", { hasText: "Service" }).locator("label").nth(4).click();
  await phone.getByRole("button", { name: "Send feedback" }).click();
  await until(() => phone.getByText("Glad you enjoyed it").isVisible());
  await phone.getByText("Glad you enjoyed it").scrollIntoViewIfNeeded();
  await phone.waitForTimeout(800);
  await save(phone, "phone-review", 780);
} catch (e) {
  console.log("stopped:", e.message.split("\n")[0]);
} finally {
  if (rid) {
    const { data: staff } = await db.from("staff").select("user_id").eq("restaurant_id", rid);
    await db.from("restaurants").delete().eq("id", rid);
    for (const s of staff ?? []) await db.auth.admin.deleteUser(s.user_id);
    console.log("copy deleted");
  }
  await b.close();
}
