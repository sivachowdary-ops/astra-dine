// Read-only health check of the shared Supabase project: connection, sizes, showcase data and
// how fresh it is. Prints counts only, never keys or personal data.
// Usage: node scripts/health.mjs
import { readFileSync } from "node:fs";
import pg from "pg";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const t0 = Date.now();
await c.connect();
const q = async (sql) => (await c.query(sql)).rows;
const [{ db_size }] = await q("select pg_size_pretty(pg_database_size(current_database())) as db_size");
console.log(`connected in ${Date.now() - t0} ms, database size ${db_size}`);
console.log(
  "restaurants:",
  (await q("select slug, (expires_at is not null) as trial from restaurants order by created_at")).map((r) => `${r.slug}${r.trial ? " (trial)" : ""}`).join(", "),
);
const [d] = await q(`select
  (select count(*) from orders) as orders,
  (select max(placed_at) from orders) as last_order,
  (select count(*) from payments) as payments,
  (select count(*) from crm_leads) as leads,
  (select max(created_at) from crm_leads where tag is null) as last_lead,
  (select count(*) from auth.users) as users`);
console.log(d);
const [s] = await q(`select
  (select coalesce(sum((metadata->>'size')::bigint),0) from storage.objects) as storage_bytes,
  (select count(*) from storage.objects) as files`);
console.log(`storage: ${(Number(s.storage_bytes) / 1e6).toFixed(1)} MB in ${s.files} files`);
await c.end();
