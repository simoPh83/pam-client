// Explores how reliably we can extract parent references + normalised addresses
// programmatically from the applications table.
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

// 1) How many applications look like discharges/amendments, and how many of
//    those have an extractable parent reference in the description?
const stats = await client.query(`
  with c0 as (
    select uid, authority, description
    from applications
    where description ~* '(pursuant to|relating to|of (planning )?permission|to planning permission|amendment to|variation of|permission ref)'
      and app_type is distinct from 'Trees'
  ),
  extracted as (
    select uid,
      (select m[1] from regexp_matches(description,
        '(?:permission|application|consent|pp|pa|lbc|planning permission)\\s*(?:ref(?:erence)?[.:]?\\s*|no[.:]?\\s*|\\()?([A-Z0-9][A-Z0-9/_.-]{4,20})',
        'i') as m limit 1) as parent_ref
    from c0
  )
  select
    (select count(*)::int from c0) as c0_total,
    count(parent_ref)::int as with_parent,
    count(distinct parent_ref)::int as distinct_parents
  from extracted
`);
console.log("discharge/amendment rows:", stats.rows[0]);

// 2) Sample of extracted parent refs
const sample = await client.query(`
  select uid, authority,
    (select m[1] from regexp_matches(description,
      '(?:permission|application|consent|pp|pa|lbc|planning permission)\\s*(?:ref(?:erence)?[.:]?\\s*|no[.:]?\\s*|\\()?([A-Z0-9][A-Z0-9/_.-]{4,20})',
      'i') as m limit 1) as parent_ref
  from applications
  where description ~* '(pursuant to|relating to|of (planning )?permission|amendment to|variation of)'
    and app_type is distinct from 'Trees'
  limit 15
`);
console.log("\nsample parent refs:");
for (const r of sample.rows) console.log(" ", r.uid, "→", r.parent_ref);

// 3) Do those parent refs resolve to rows in our own table (same authority)?
const resolve = await client.query(`
  with extracted as (
    select uid, authority,
      (select m[1] from regexp_matches(description,
        '(?:permission|application|consent|pp|pa|lbc|planning permission)\\s*(?:ref(?:erence)?[.:]?\\s*|no[.:]?\\s*|\\()?([A-Z0-9][A-Z0-9/_.-]{4,20})',
        'i') as m limit 1) as parent_ref
    from applications
    where description ~* '(pursuant to|relating to|of (planning )?permission|amendment to|variation of)'
      and app_type is distinct from 'Trees'
  )
  select count(*)::int as total,
         count(p.uid)::int as parent_in_db
  from extracted e
  left join applications p on p.reference = e.parent_ref and p.authority = e.authority
  where e.parent_ref is not null
`);
console.log("\nparent refs resolving to a row in applications:", resolve.rows[0]);

// 4) Address normalisation: UPRN coverage + how well plain address grouping works
const addr = await client.query(`
  select
    count(*)::int as total,
    count(uprn)::int as with_uprn,
    count(distinct uprn)::int as distinct_uprns
  from applications
`);
console.log("\nUPRN coverage:", addr.rows[0]);

// 5) Address-based clustering sanity check: top clusters by row count
const clusters = await client.query(`
  select upper(regexp_replace(address, '\\s+', ' ', 'g')) as norm_addr, authority,
         count(*)::int as n, min(start_date) as first, max(decided_date) as latest
  from applications
  where address is not null
  group by 1, 2
  having count(*) >= 5
  order by n desc
  limit 10
`);
console.log("\nbiggest address clusters (same-site repeat applications):");
for (const r of clusters.rows) console.log(` ${r.n}x ${r.authority} | ${r.norm_addr.slice(0, 60)} | ${r.first?.toISOString?.().slice(0, 10)} → ${r.latest?.toISOString?.().slice(0, 10)}`);

await client.end();
