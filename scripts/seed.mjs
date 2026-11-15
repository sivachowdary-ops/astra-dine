// Creates the showcase restaurant (Kaaram Kitchen) as a real account in Supabase: owner, kitchen
// and cashier logins, the menu, 32 tables, loyalty members and 60 days of past bills so the
// reports have something to show. Logins are written to demo-logins.local.txt (never committed).
// Usage: npm run db:seed            (safe to run again: it replaces the showcase restaurant)
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { sampleCategories, sampleItems } from "../src/lib/sample-menu.ts";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, SUPABASE_DB_URL: dbUrl } = process.env;
if (!url || !key || !dbUrl) {
  console.error("Fill in .env.local first (URL, service role key and database URL).");
  process.exit(1);
}
const supa = createClient(url, key, { auth: { persistSession: false } });
const db = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await db.connect();

const SLUG = "kaaram-kitchen";
const ownerEmail = process.env.SEED_OWNER_EMAIL || "owner@kaaram-kitchen.astradine.app";
const pass = () => randomBytes(6).toString("base64url");
const logins = { owner: { email: ownerEmail, password: pass() }, kitchen: pass(), cashier: pass() };

// Start clean: remove the old showcase restaurant and its logins.
const old = await db.query("select id from restaurants where slug = $1", [SLUG]);
if (old.rows[0]) {
  const users = await db.query("select user_id from staff where restaurant_id = $1", [old.rows[0].id]);
  for (const u of users.rows) await supa.auth.admin.deleteUser(u.user_id);
  await db.query("delete from restaurants where id = $1", [old.rows[0].id]);
}
const { data: list } = await supa.auth.admin.listUsers({ perPage: 1000 });
for (const u of list?.users ?? []) if (u.email === ownerEmail || u.email?.endsWith(`@${SLUG}.staff.astradine.app`)) await supa.auth.admin.deleteUser(u.id);

const rid = randomUUID();
await db.query(
  `insert into restaurants (id, slug, name, place, gstin, gst_pct, upi_vpa, upi_name, stamps_for_reward, stamp_min_bill, reward_text, reward_value)
   values ($1, $2, 'Kaaram Kitchen', 'Benz Circle, Vijayawada', null, 5, null, 'Kaaram Kitchen', 6, 300, 'Free dessert', 169)`,
  [rid, SLUG],
);

async function user(email, password, name, username, role) {
  const { data, error } = await supa.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
  if (error) throw error;
  await db.query("insert into staff (user_id, restaurant_id, name, username, role) values ($1, $2, $3, $4, $5)", [data.user.id, rid, name, username, role]);
}
await user(logins.owner.email, logins.owner.password, "Showcase owner", "owner", "owner");
await user(`kitchen@${SLUG}.staff.astradine.app`, logins.kitchen, "Kitchen screen", "kitchen", "kitchen");
await user(`cashier@${SLUG}.staff.astradine.app`, logins.cashier, "Front counter", "cashier", "cashier");

// Menu
const catIds = {};
for (const [i, c] of sampleCategories.entries()) {
  const id = randomUUID();
  catIds[c.id] = id;
  await db.query("insert into categories (id, restaurant_id, name, note, sort) values ($1, $2, $3, $4, $5)", [id, rid, c.name, c.note ?? null, i]);
}
const items = [];
for (const [i, m] of sampleItems.entries()) {
  const id = randomUUID();
  items.push({ ...m, uuid: id });
  await db.query(
    `insert into menu_items (id, restaurant_id, category_id, name, local_name, description, price, diet, spice, station, prep_minutes, tags, variants, addons, serves, sort)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [id, rid, catIds[m.category], m.name, m.local ?? null, m.desc, m.price, m.diet, m.spice, m.station, m.prep, m.tags, JSON.stringify(m.variants ?? []), JSON.stringify(m.addons ?? []), m.serves ?? null, i],
  );
}

// Tables
const tables = [];
const areas = [
  ["Ground floor", 12, (i) => (i % 3 === 0 ? 2 : 4)],
  ["AC hall", 12, (i) => (i % 4 === 0 ? 6 : 4)],
  ["Terrace", 8, (i) => (i % 2 ? 4 : 2)],
];
let n = 1;
for (const [area, count, seats] of areas) {
  for (let i = 0; i < count; i++, n++) {
    const id = randomUUID();
    tables.push(id);
    await db.query("insert into dining_tables (id, restaurant_id, label, area, seats, sort) values ($1, $2, $3, $4, $5, $6)", [id, rid, String(n), area, seats(i), n]);
  }
}

// Seeded random, so every seed looks the same.
let s = 20261115;
const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const pick = (a) => a[Math.floor(r() * a.length)];

// Loyalty members (numbers start with 5: no real person can be reached).
const first = ["Lakshmi", "Arjun", "Fatima", "Ravi", "Sravani", "Kiran", "Meena", "Anil", "Divya", "Imran", "Pooja", "Suresh", "Bhavana", "Teja", "Harika", "Naveen", "Swathi", "Rahul", "Keerthi", "Vamsi"];
const last = ["Reddy", "Varma", "Shaik", "Rao", "Naidu", "Chowdary", "Kumar", "Prasad", "Sharma", "Gutta"];
const members = Array.from({ length: 420 }, (_, i) => ({ id: randomUUID(), phone: `+9155${String(10000000 + i * 7919).slice(0, 8)}`, name: `${pick(first)} ${pick(last)}`, optIn: r() < 0.85, visits: 0, stamps: 0, rewards: 0, spend: 0, last: null, joined: null }));

// 60 days of bills
const weights = items.map((m) => (m.tags.includes("bestseller") ? 9 : m.tags.includes("chef") ? 5 : 2));
const totalW = weights.reduce((a, b) => a + b, 0);
const dish = () => {
  let x = r() * totalW;
  for (let i = 0; i < items.length; i++) if ((x -= weights[i]) <= 0) return items[i];
  return items[0];
};
const today = new Date();
today.setHours(0, 0, 0, 0);
let kot = 0;
let bill = 0;
const sessions = [];
const orders = [];
const lines = [];
const payments = [];
for (let d = 60; d >= 1; d--) {
  const day = new Date(today.getTime() - d * 86_400_000);
  const dow = day.getDay();
  const count = Math.round(95 * (dow === 0 || dow === 6 ? 1.35 : 1) * (0.85 + r() * 0.3));
  for (let k = 0; k < count; k++) {
    const hour = pick([8, 9, 10, 12, 13, 13, 14, 15, 19, 19, 20, 20, 20, 21, 21, 22]);
    const opened = new Date(day.getTime() + hour * 3_600_000 + Math.floor(r() * 3_600_000));
    const paid = new Date(opened.getTime() + (35 + r() * 40) * 60_000);
    const sid = randomUUID();
    const guests = 1 + Math.floor(r() * 5);
    const viaQr = d <= 45 && r() < 0.35 + ((45 - d) / 45) * 0.4;
    const oid = randomUUID();
    kot++;
    orders.push([oid, rid, sid, kot, viaQr ? "qr" : "staff", opened.toISOString(), opened.toISOString()]);
    let subtotal = 0;
    const nDishes = 1 + Math.floor(guests * (0.8 + r() * 0.8));
    for (let j = 0; j < nDishes; j++) {
      const m = dish();
      if (m.hours && !(hour >= m.hours[0] && hour < m.hours[1])) continue;
      const qty = m.category === "breads" || m.category === "drinks" ? 1 + Math.floor(r() * 3) : 1;
      const variant = m.variants?.at(-1);
      const price = variant ? variant.price : m.price;
      subtotal += price * qty;
      const fired = new Date(opened.getTime() + 60_000);
      lines.push([randomUUID(), rid, oid, sid, m.uuid, m.name, variant?.label ?? null, qty, price, m.station, "served", opened.toISOString(), fired.toISOString(), new Date(fired.getTime() + m.prep * 60_000 * (0.8 + r() * 0.6)).toISOString()]);
    }
    if (!subtotal) {
      orders.pop();
      continue;
    }
    const total = Math.round(subtotal * 1.05);
    bill++;
    const member = r() < 0.45 ? members[Math.floor(r() * r() * members.length)] : null;
    let stamped = false;
    if (member) {
      member.joined ??= opened.toISOString();
      member.visits++;
      member.spend += total;
      member.last = paid.toISOString();
      if (total >= 300) {
        stamped = true;
        member.stamps++;
        if (member.stamps >= 6) {
          member.stamps = 0;
          member.rewards++;
        }
      }
    }
    sessions.push([sid, rid, pick(tables), "closed", guests, member?.id ?? null, bill, stamped, subtotal, total, viaQr, opened.toISOString(), paid.toISOString(), paid.toISOString()]);
    const mode = r() < 0.66 ? "upi" : r() < 0.7 ? "cash" : "card";
    payments.push([randomUUID(), rid, sid, mode, total, "confirmed", paid.toISOString()]);
  }
}

async function bulk(table, cols, rows, size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const params = [];
    const values = chunk.map((row) => `(${row.map((v) => (params.push(v), `$${params.length}`)).join(",")})`).join(",");
    await db.query(`insert into ${table} (${cols.join(",")}) values ${values}`, params);
  }
}
const joined = members.filter((m) => m.joined);
await bulk("members", ["id", "restaurant_id", "phone", "name", "visits", "stamps", "rewards_ready", "spend", "opt_in", "last_visit", "joined_at"], joined.map((m) => [m.id, rid, m.phone, m.name, m.visits, m.stamps, m.rewards, m.spend, m.optIn, m.last, m.joined]));
await bulk("table_sessions", ["id", "restaurant_id", "table_id", "status", "guests", "member_id", "bill_no", "stamped", "subtotal", "total", "via_qr", "opened_at", "paid_at", "closed_at"], sessions.map((x) => (joined.some((m) => m.id === x[5]) ? x : [...x.slice(0, 5), null, ...x.slice(6)])));
await bulk("orders", ["id", "restaurant_id", "session_id", "kot", "source", "placed_at", "confirmed_at"], orders);
await bulk("order_lines", ["id", "restaurant_id", "order_id", "session_id", "item_id", "name", "variant", "qty", "unit_price", "station", "status", "created_at", "fired_at", "ready_at"], lines, 400);
await bulk("payments", ["id", "restaurant_id", "session_id", "mode", "amount", "status", "at"], payments);
await db.query("update restaurants set kot_seq = $1, bill_seq = $2 where id = $3", [kot, bill, rid]);

// A few gift cards and past feedback
await bulk("gift_cards", ["id", "restaurant_id", "code", "value", "balance", "from_name", "to_name"], [
  [randomUUID(), rid, "KA-7Q2MX", 1000, 1000, "Arjun Varma", "Lakshmi Reddy"],
  [randomUUID(), rid, "KA-B4TXP", 2000, 640, "Sravani M.", "Kiran"],
]);
const comments = ["Gongura mutton was the best in town.", "Quick service even on a Saturday.", "Waited 25 minutes for the naan.", "Loved ordering from the phone.", "Biryani was a bit dry today."];
await bulk("feedback", ["id", "restaurant_id", "table_label", "guest_name", "food", "service", "comment", "route", "handled", "at"], comments.map((c, i) => {
  const low = c.includes("Waited") || c.includes("dry");
  return [randomUUID(), rid, String(3 + i * 5), pick(first), low ? 3 : 5, low ? 2 : 5, c, low ? "manager" : "google-ask", i > 2, new Date(Date.now() - (i + 1) * 86_400_000).toISOString()];
}));

await db.end();
writeFileSync(
  new URL("../demo-logins.local.txt", import.meta.url),
  `Kaaram Kitchen showcase logins (keep private, never commit)\n\nRestaurant code: ${SLUG}\n\nAdmin (/admin)\n  Email: ${logins.owner.email}\n  Password: ${logins.owner.password}\n\nKitchen (/kitchen)\n  Username: kitchen\n  Password: ${logins.kitchen}\n\nCashier (/pos)\n  Username: cashier\n  Password: ${logins.cashier}\n`,
);
console.log(`Kaaram Kitchen ready: ${items.length} dishes, ${tables.length} tables, ${joined.length} members, ${sessions.length} past bills.`);
console.log("Logins written to demo-logins.local.txt");
