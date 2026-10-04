// Ad-hoc investigation: applications with Savills as agent, decided in last 3 months.
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
  select a.uid, a.reference, a.authority, a.address, a.app_type, a.app_size,
         a.app_state, a.decided_date, a.description, a.agent_display,
         a.applicant_name, a.n_documents, a.n_dwellings,
         f.council_url, f.docs_url, f.source_url
  from applications a
  left join applications_full f on f.uid = a.uid
  where a.agent_display ilike '%savills%'
    and a.decided_date >= '2026-07-04'
    and a.app_state in ('Permitted', 'Conditions')
  order by a.decided_date desc
  limit 10
`);

// Clean UTF-8 JSON for the investigation pipeline
const clean = rows.map((r) => ({
  ...r,
  decided_date: r.decided_date?.toISOString?.().slice(0, 10) ?? r.decided_date,
}));
writeFileSync("scripts/savills-top10.json", JSON.stringify(clean, null, 2));

for (const r of clean) {
  console.log(
    [
      r.decided_date,
      r.authority,
      r.reference,
      r.app_state,
      r.app_size,
      `docs:${r.n_documents}`,
      (r.description ?? "").replace(/\s+/g, " ").slice(0, 100),
    ].join(" | ")
  );
}

await client.end();
