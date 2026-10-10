// Usage: node scripts/run-sql.mjs <file.sql> [--json]
// Runs one SQL file inside a READ ONLY transaction and prints the rows.
import { readFileSync } from "node:fs";
import pg from "pg";

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/run-sql.mjs <file.sql> [--json]");
  process.exit(1);
}
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
try {
  await client.query("begin read only");
  await client.query("set local statement_timeout = '120s'");
  const res = await client.query(readFileSync(file, "utf8"));
  const rows = res.rows;
  if (process.argv.includes("--json")) console.log(JSON.stringify(rows, null, 1));
  else console.table(rows);
  console.log(`${rows.length} rows`);
} finally {
  await client.query("rollback").catch(() => {});
  await client.end();
}
