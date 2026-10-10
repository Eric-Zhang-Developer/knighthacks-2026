---
name: Keep the production schema in step with main, additive only, and say when it isn't
depends_on: [bootstrap]
owns: [scripts/db-sync.mjs, app/api/health/schema/, tests/db-sync/, tests/e2e/db-sync/]
assignee: ""
---

# Schema sync

Nothing applies `db/schema/` to production. #113 was a hand push; two tables merged after it (`assumptions`,
`moments`) were missing within the hour, so change-mind and moment failed live while health said 200.
`drizzle-kit push` is unsafe here: it drops any table the checkout has no file for (#125).

## Plan
1. `scripts/db-sync.mjs`: export the schema with `drizzle-kit export --sql`, read `information_schema` for the
   target `DATABASE_URL`, and print the plan: tables, indexes and foreign keys that are missing.
2. `--apply` runs that plan in one transaction. Without it, nothing is written.
3. `GET /api/health/schema`: `{"schema": "ok"}`, or `{"schema": {"missing": [<table names>]}}` with status 503.
   It's added to `[release].smoke_paths` (a `contract:` PR), so `verify_release.py` fails on missing tables.

## Requirements
- The plan contains only `CREATE TABLE`, `CREATE INDEX` and `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY` for
  objects whose names are absent. It never drops, alters a column or touches an existing object.
- An existing table that lacks a column the schema defines (compared by column name; types aren't parsed) is
  listed as `drift: <table>.<column>` and makes the script exit 2 before anything is applied. No automatic fix.
- Against any target but `TEST_DATABASE_URL`, refuse to run (exit 2) unless the checkout is clean and `HEAD`
  equals `origin/main`. The shared test branch is exempt, so a feature branch adds its own new tables with this
  script instead of hand-written SQL (#125).
- The schema route reads one `information_schema` query, cached for 60 seconds. It's a separate path because
  `/api/health` is the liveness check the verifier, bootstrap and build-root suites expect to be exactly
  `{"commit"}` with 200. The expected tables come from every `db/schema/` file at build time (webpack
  `require.context`), so a new schema file needs no edit to the route.
- Who runs `--apply` on production: the agent that merges a PR adding a `db/schema/` table, right after the merge
  (the person approved this on #113, option A). The command and its printed plan go in a comment on that PR.

## Validation
1. Against the test branch with one table dropped on purpose -> the dry run lists exactly that table; `--apply`
   creates it; a second dry run prints `nothing to apply`.
2. A table lacking a schema column -> `drift:` line, exit 2, nothing applied (unit-tested; dropping a real
   column on the shared test branch would break other features' tests).
3. Run from a feature branch against a non-test target -> exit 2.
4. `/api/health/schema` with a table missing -> 503 and its `missing` list; after `--apply` -> 200 and `"ok"`.
   `/api/health` stays 200 with `{"commit"}` either way.
5. `tests/db-sync/` pins the statement filter: a `DROP` or an `ALTER COLUMN` in the export never reaches the plan.

## Defaults
Cache miss on health with the database down: 503 with `schema: "unknown"`, never a guessed `ok`.
