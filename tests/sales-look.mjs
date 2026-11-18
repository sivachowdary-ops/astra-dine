// Screenshots the sales page at desktop and phone widths, and checks it with axe.
import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
import AxeBuilder from "../../../node_modules/@axe-core/playwright/dist/index.mjs";
const base = process.argv[2] ?? "http://localhost:3106";
const b = await chromium.launch({ channel: "chrome" });
const errors = [];
for (const [name, viewport] of [["desk", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
  const p = await (await b.newContext({ viewport, deviceScaleFactor: name === "phone" ? 2 : 1 })).newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await p.goto(base + "/", { waitUntil: "load" });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
  await p.waitForTimeout(3500);
  await p.screenshot({ path: `test-results/sales-${name}.png` });
  await p.evaluate(() => window.scrollTo(0, 600));
  await p.waitForTimeout(400);
  await p.screenshot({ path: `test-results/sales-${name}-2.png` });
  await p.screenshot({ path: `test-results/sales-${name}-full.png`, fullPage: true });
  if (await p.locator("#evening").count()) {
    await p.locator("#evening").evaluate((e) => e.scrollIntoView());
    await p.waitForTimeout(600);
    await p.screenshot({ path: `test-results/sales-${name}-evening.png` });
    await p.evaluate(() => window.scrollBy(0, 900));
    await p.waitForTimeout(600);
    await p.screenshot({ path: `test-results/sales-${name}-evening-2.png` });
  }
  await p.locator("#try").evaluate((e) => e.scrollIntoView());
  await p.waitForTimeout(800);
  await p.screenshot({ path: `test-results/sales-${name}-try.png` });
  const axe = await new AxeBuilder({ page: p }).analyze();
  console.log(name, "axe:", axe.violations.map((v) => `${v.id} (${v.nodes.length})`).join(", ") || "clean");
  for (const v of axe.violations) for (const n of v.nodes) console.log("  ", n.target.join(" "), n.any[0]?.message?.slice(0, 140));
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log(name, "horizontal overflow px:", sw);
}
console.log("errors", errors.slice(0, 5));
await b.close();
