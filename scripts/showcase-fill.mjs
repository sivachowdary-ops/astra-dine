// Keeps the showcase restaurant's history up to date: adds the bills Kaaram Kitchen "would have"
// taken between the last sample bill and now, so Today and Reports never show an empty gap.
// Safe to run again (it only fills time after the last sample bill). Run it before a demo, or
// daily from a scheduler once deployed.
// Usage: npm run db:fill
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
if (!process.env.SUPABASE_DB_URL) {
  console.error("Fill in SUPABASE_DB_URL in .env.local first.");
  process.exit(1);
}
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

const { rows: [r] } = await db.query("select id, gst_pct, stamps_for_reward, stamp_min_bill, kot_seq, bill_seq from restaurants where slug = 'kaaram-kitchen'");
if (!r) {
  console.error("No showcase restaurant. Run npm run db:seed first.");
  process.exit(1);
}
const rid = r.id;
// Sample bills are the ones closed at the moment they were paid; real ones close later.
const { rows: [mark] } = await db.query("select max(opened_at) as at from table_sessions where restaurant_id = $1 and closed_at = paid_at", [rid]);
const from = mark.at ? new Date(mark.at) : new Date(Date.now() - 86_400_000);
const now = new Date();

const { rows: items } = await db.query(
  `select m.id, m.name, m.price, m.variants, m.station, m.prep_minutes, m.tags, c.name as category, c.available_from, c.available_to
   from menu_items m join categories c on c.id = m.category_id where m.restaurant_id = $1 and m.available`,
  [rid],
);
const { rows: tables } = await db.query("select id from dining_tables where restaurant_id = $1", [rid]);
const { rows: members } = await db.query("select id, visits, stamps, rewards_ready, spend from members where restaurant_id = $1 order by joined_at", [rid]);

// Seeded per day, so the same day always gets the same bills.
let s = 1;
const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const weights = items.map((m) => (m.tags.includes("bestseller") ? 9 : m.tags.includes("chef") ? 5 : 2));
const totalW = weights.reduce((a, b) => a + b, 0);
const dish = () => {
  let x = rnd() * totalW;
  for (let i = 0; i < items.length; i++) if ((x -= weights[i]) <= 0) return items[i];
  return items[0];
};
const toH = (t) => (t ? Number(t.slice(0, 2)) + Number(t.slice(3, 5)) / 60 : null);
const serves = (m, hour) => {
  const a = toH(m.available_from);
  const b = toH(m.available_to);
  return a === null || b === null || (hour >= a && hour < b);
};

const IST = 330 * 60_000;
const istMidnight = (d) => {
  const t = new Date(d.getTime() + IST);
  t.setUTCHours(0, 0, 0, 0);
  return new Date(t.getTime() - IST);
};
let kot = Number(r.kot_seq);
let bill = Number(r.bill_seq);
const sessions = [];
const orders = [];
const lines = [];
const payments = [];
const touched = new Map();
for (let day = istMidnight(from); day < now; day = new Date(day.getTime() + 86_400_000)) {
  s = Math.floor(day.getTime() / 86_400_000);
  const dow = new Date(day.getTime() + IST).getUTCDay();
  const count = Math.round(95 * (dow === 0 || dow === 6 ? 1.35 : 1) * (0.85 + rnd() * 0.3));
  for (let k = 0; k < count; k++) {
    const hour = pick([8, 9, 10, 12, 13, 13, 14, 15, 19, 19, 20, 20, 20, 21, 21, 22]);
    const opened = new Date(day.getTime() + hour * 3_600_000 + Math.floor(rnd() * 3_600_000));
    const paid = new Date(opened.getTime() + (35 + rnd() * 40) * 60_000);
    const guests = 1 + Math.floor(rnd() * 5);
    const viaQr = rnd() < 0.78;
    const picks = Array.from({ length: 1 + Math.floor(guests * (0.8 + rnd() * 0.8)) }, () => [dish(), rnd(), rnd()]);
    const memberRoll = rnd();
    const memberIdx = Math.floor(rnd() * rnd() * members.length);
    const modeRoll = [rnd(), rnd()];
    const table = pick(tables).id;
    // Draw every number first, so skipping a bill never shifts the ones after it.
    if (opened <= from || paid >= now) continue;
    const sid = randomUUID();
    const oid = randomUUID();
    let subtotal = 0;
    const these = [];
    for (const [m, q, speed] of picks) {
      if (!serves(m, hour + 0.5)) continue;
      const qty = /bread|drink/i.test(m.category) ? 1 + Math.floor(q * 3) : 1;
      const variant = m.variants?.at(-1);
      const price = variant ? variant.price : m.price;
      subtotal += price * qty;
      const fired = new Date(opened.getTime() + 60_000);
      these.push([randomUUID(), rid, oid, sid, m.id, m.name, variant?.label ?? null, qty, price, m.station, "served", opened.toISOString(), fired.toISOString(), new Date(fired.getTime() + m.prep_minutes * 60_000 * (0.8 + speed * 0.6)).toISOString()]);
    }
    if (!subtotal) continue;
    kot++;
    bill++;
    const total = Math.round(subtotal * (1 + Number(r.gst_pct) / 100));
    const member = memberRoll < 0.45 && members.length ? members[memberIdx] : null;
    let stamped = false;
    if (member) {
      member.visits++;
      member.spend = Number(member.spend) + total;
      member.last = paid.toISOString();
      if (total >= r.stamp_min_bill) {
        stamped = true;
        member.stamps++;
        if (member.stamps >= r.stamps_for_reward) {
          member.stamps = 0;
          member.rewards_ready++;
        }
      }
      touched.set(member.id, member);
    }
    orders.push([oid, rid, sid, kot, viaQr ? "qr" : "staff", opened.toISOString(), opened.toISOString()]);
    lines.push(...these);
    sessions.push([sid, rid, table, "closed", guests, member?.id ?? null, bill, stamped, subtotal, total, viaQr, opened.toISOString(), paid.toISOString(), paid.toISOString()]);
    payments.push([randomUUID(), rid, sid, modeRoll[0] < 0.66 ? "upi" : modeRoll[1] < 0.7 ? "cash" : "card", total, "confirmed", paid.toISOString()]);
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
await db.query("begin");
await bulk("table_sessions", ["id", "restaurant_id", "table_id", "status", "guests", "member_id", "bill_no", "stamped", "subtotal", "total", "via_qr", "opened_at", "paid_at", "closed_at"], sessions);
await bulk("orders", ["id", "restaurant_id", "session_id", "kot", "source", "placed_at", "confirmed_at"], orders);
await bulk("order_lines", ["id", "restaurant_id", "order_id", "session_id", "item_id", "name", "variant", "qty", "unit_price", "station", "status", "created_at", "fired_at", "ready_at"], lines, 400);
await bulk("payments", ["id", "restaurant_id", "session_id", "mode", "amount", "status", "at"], payments);
for (const m of touched.values()) {
  await db.query("update members set visits = $1, stamps = $2, rewards_ready = $3, spend = $4, last_visit = greatest(last_visit, $5) where id = $6", [m.visits, m.stamps, m.rewards_ready, m.spend, m.last, m.id]);
}
// Live numbers keep counting on from here.
await db.query("update restaurants set kot_seq = greatest(kot_seq, $1), bill_seq = greatest(bill_seq, $2) where id = $3", [kot, bill, rid]);
await db.query("commit");
await db.end();
console.log(`Added ${sessions.length} bills from ${from.toISOString().slice(0, 16)} to now.`);
