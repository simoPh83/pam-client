// Architect-hunter fast path: given an application uid (e.g. "Islington/P2024/3089/FUL"
// or a PAM lead URL), print the council portal URLs as JSON — skips browser login.
import { readFileSync } from "node:fs";
import pg from "pg";

let uid = process.argv[2];
if (!uid) {
  console.error('usage: node scripts/portal-url.mjs "<uid|lead-url>"');
  process.exit(1);
}
const m = uid.match(/[?&]uid=([^&]+)/);
if (m) uid = decodeURIComponent(m[1]);

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const kv = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (kv) env[kv[1]] = kv[2];
}

const client = new pg.Client({
  connectionString: env.DATABASE_URL.replace(":6543/", ":5432/"),
  ssl: { rejectUnauthorized: false },
});

await client.connect();
const { rows } = await client.query(
  `select a.uid, a.reference, a.authority, a.address, a.description,
          a.agent_display, a.app_state, a.decided_date, a.n_documents,
          f.council_url, f.docs_url, f.source_url
   from applications a
   left join applications_full f on f.uid = a.uid
   where a.uid = $1`,
  [uid]
);
await client.end();

if (!rows.length) {
  console.error(`no application found for uid "${uid}"`);
  process.exit(1);
}
const r = rows[0];
console.log(
  JSON.stringify(
    {
      ...r,
      decided_date: r.decided_date?.toISOString?.().slice(0, 10) ?? r.decided_date,
    },
    null,
    2
  )
);
