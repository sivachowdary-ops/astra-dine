// Applies supabase/migrations/*.sql in order to the database in SUPABASE_DB_URL (.env.local).
// Each file is written to be safe to run again.
import { readFileSync, readdirSync } from "node:fs";
import pg from "pg";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
if (!process.env.SUPABASE_DB_URL) {
  console.error("Add SUPABASE_DB_URL to .env.local first.");
  process.exit(1);
}
const dir = new URL("../supabase/migrations/", import.meta.url);
const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
  process.stdout.write(`Applying ${f}… `);
  await client.query(readFileSync(new URL(f, dir), "utf8"));
  console.log("done");
}
await client.end();
