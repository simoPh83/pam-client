// Sanity check: leads view, ui_* tables, and RLS policies exist.
import { readFileSync } from "node:fs";
import pg from "pg";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const client = new pg.Client({
  connectionString: env.DATABASE_URL.replace(":6543/", ":5432/"),
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const leads = await client.query("select count(*)::int as n from leads");
console.log("leads view rows:", leads.rows[0].n);

const tables = await client.query(
  "select table_name from information_schema.tables where table_schema='public' and table_name like 'ui_%' order by 1"
);
console.log("ui tables:", tables.rows.map((r) => r.table_name).join(", "));

const policies = await client.query(
  "select tablename, policyname, cmd from pg_policies where tablename like 'ui_%' order by 1"
);
for (const p of policies.rows)
  console.log(`policy: ${p.tablename} → ${p.policyname} (${p.cmd})`);

const sample = await client.query(
  "select uid, reference, authority, app_state, decided_date from leads order by decided_date desc nulls last limit 3"
);
console.log("sample leads:", JSON.stringify(sample.rows, null, 2));

await client.end();
