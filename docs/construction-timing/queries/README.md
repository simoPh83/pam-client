# Queries

Numbered, reproducible, read-only SQL (`01-app-type-state-census.sql`, …; 01–07 so far). Each file starts with a
comment stating its purpose and the findings.md entry it supports.

Run with `node scripts/run-sql.mjs <file.sql>` (read-only transaction, 120s timeout).
Keep heavy queries bounded (`limit`, authority or date filters): `authenticated` statement
timeout is 60s and `projects_feed` is slow when filtered on computed columns.
