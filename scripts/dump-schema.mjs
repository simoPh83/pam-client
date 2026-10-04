// Dumps the live schema (columns + types) for the tables the app cares about.
import { readFileSync, writeFileSync } from "node:fs";
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

const { rows } = await client.query(`
  select table_name, column_name, data_type, is_nullable
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('applications', 'applications_full', 'state_history',
                       'jobs', 'leads', 'ui_outreach', 'ui_lead_meta',
                       'ui_saved_filters', 'authority_urls',
                       'projects', 'project_applications')
  order by table_name, ordinal_position
`);

let out = "";
let current = "";
for (const r of rows) {
  if (r.table_name !== current) {
    current = r.table_name;
    out += `\n## ${current}\n`;
  }
  out += `${r.column_name}: ${r.data_type}${r.is_nullable === "YES" ? "?" : ""}\n`;
}

writeFileSync("scripts/schema-dump.txt", out);
console.log(out);
await client.end();
