// Signs in to the admin dashboard as the showcase owner and screenshots every section.
import { readFileSync } from "node:fs";
import { chromium } from "../../../node_modules/@playwright/test/index.mjs";
const logins = readFileSync(new URL("../demo-logins.local.txt", import.meta.url), "utf8");
const email = logins.match(/Email: (\S+)/)[1];
const password = logins.match(/Admin[\s\S]*?Password: (\S+)/)[1];
const base = process.argv[2] ?? "http://localhost:3106";
const b = await chromium.launch({ channel: "chrome" });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await p.goto(base + "/admin", { waitUntil: "networkidle" });
await p.waitForTimeout(1500); // let the form hydrate before typing
await p.screenshot({ path: "test-results/a-login.png" });
await p.getByLabel("Email").fill(email);
await p.getByLabel("Password").fill(password);
await p.getByRole("button", { name: "Sign in" }).click();
await p.getByRole("heading", { name: "Today", exact: true }).waitFor({ timeout: 30000 });
await p.waitForTimeout(2500);
await p.screenshot({ path: "test-results/a-today.png" });
for (const s of ["Menu", "Tables and QR codes", "Staff and devices", "Loyalty", "WhatsApp offers", "Feedback", "Reports", "Settings"]) {
  await p.getByRole("button", { name: s, exact: true }).click();
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `test-results/a-${s.split(" ")[0].toLowerCase()}.png` });
}
console.log("errors", errors.slice(0, 8));
await b.close();
