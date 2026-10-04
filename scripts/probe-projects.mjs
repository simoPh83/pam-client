// Quick probe of the new projects / project_applications tables.
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

const counts = await client.query(`
  select
    (select count(*)::int from projects) as projects,
    (select count(*)::int from project_applications) as memberships,
    (select count(*)::int from projects where n_applications > 1) as multi_app_projects,
    (select count(*)::int from leads where project_id is null) as leads_without_project
`);
console.log(counts.rows[0]);

const sample = await client.query(`
  select id, authority, name, n_applications, root_uid, latest_uid, last_updated
  from projects where n_applications >= 5
  order by n_applications desc limit 5
`);
console.log("\nbiggest projects:");
for (const r of sample.rows) console.log(` ${r.id} | ${r.authority} | ${r.n_applications} apps | ${r.name} | latest: ${r.latest_uid}`);

// Does a lead row join to its project?
const join = await client.query(`
  select l.uid, l.reference, l.project_id, p.name, p.n_applications
  from leads l join projects p on p.id = l.project_id
  where l.n_applications > 1
  limit 5
`);
console.log("\nsample grouped leads:");
for (const r of join.rows) console.log(` ${r.reference} → project ${r.project_id} "${r.name}" (${r.n_applications} apps)`);

await client.end();
