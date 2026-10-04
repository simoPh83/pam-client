// Applies SQL files in supabase/migrations/ in order. Idempotent migrations only.
// Usage: pnpm migrate
// Reads DATABASE_URL from .env.local (never committed).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

function loadEnv(file) {
  const vars = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) vars[m[1]] = m[2];
  }
  return vars;
}

const env = loadEnv(".env.local");
let url = env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing from .env.local");
  process.exit(1);
}

// Migrations run best over the session pooler (5432); the app's DATABASE_URL
// points at the transaction pooler (6543). Same credentials, different port.
url = url.replace(":6543/", ":5432/");

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

const dir = "supabase/migrations";
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

await client.connect();
console.log("Connected. Applying migrations:", files.join(", "));

for (const file of files) {
  const sql = readFileSync(join(dir, file), "utf8");
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");
    console.log(`OK  ${file}`);
  } catch (err) {
    await client.query("rollback");
    console.error(`FAIL ${file}: ${err.message}`);
    process.exitCode = 1;
    break;
  }
}

await client.end();
