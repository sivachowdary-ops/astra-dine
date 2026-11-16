// Screenshots the guest's phone menu at 390 px: cover, scrolled list, an item sheet, the order bar.
import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
const base = process.argv[2] ?? "http://localhost:3106";
const token = process.argv[3];
if (!token) throw new Error("Pass a table QR token: node tests/menu-look.mjs http://localhost:3106 <token>");
const b = await chromium.launch({ channel: "chrome" });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await p.goto(`${base}/order/${token}`, { waitUntil: "load" });
await p.getByRole("heading", { name: "Most loved here" }).waitFor({ timeout: 30000 });
await p.waitForTimeout(1500);
await p.screenshot({ path: "test-results/m-1-top.png" });
await p.mouse.wheel(0, 700);
await p.waitForTimeout(800);
await p.screenshot({ path: "test-results/m-2-loved.png" });
await p.getByRole("heading", { name: "Starters", exact: true }).scrollIntoViewIfNeeded().catch(() => {});
await p.evaluate(() => window.scrollBy(0, -120));
await p.waitForTimeout(800);
await p.screenshot({ path: "test-results/m-3-list.png" });
await p.evaluate(() => window.scrollTo(0, 3200));
await p.waitForTimeout(1200);
await p.screenshot({ path: "test-results/m-6-deep.png" });
await p.evaluate(() => window.scrollTo(0, 0));
await p.waitForTimeout(600);
const firstAdd = p.getByRole("button", { name: /^Add / }).nth(2);
await firstAdd.click();
await p.waitForTimeout(600);
await p.screenshot({ path: "test-results/m-4-after-add.png" });
const sheetOpener = p.getByRole("button", { name: /Andhra chicken biryani|biryani/i }).first();
if (await sheetOpener.count()) {
  await sheetOpener.scrollIntoViewIfNeeded();
  await sheetOpener.click();
  await p.waitForTimeout(800);
  await p.screenshot({ path: "test-results/m-5-sheet.png" });
}
console.log("errors", errors.slice(0, 8));
await b.close();
