# Combinations additive test schema

The schema source of truth is `db/schema/combinations.ts`. Following shared-database safety #125, only the root operator applies the reviewed additive statement from `tests/combinations-api/test-schema.sql` to the dedicated test branch:

```sql
CREATE TABLE IF NOT EXISTS "combinations" (
  "version_id" uuid PRIMARY KEY REFERENCES "idea_versions"("id") ON DELETE CASCADE,
  "data" jsonb NOT NULL,
  "source_excerpts" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
```

Before application, inspect any existing `combinations` table: version_id must be a UUID primary key, with the cascading foreign key to idea_versions.id; data/source_excerpts must be nonnullable jsonb; created_at must be nonnullable timestamptz default now(). IF NOT EXISTS alone is not a shape check. Do not alter/drop an incompatible table implicitly; coordinate an explicit repair with its owner.

Root operator validation: the additive table was applied to the dedicated TEST branch; catalog inspection confirmed exact column types, nullability/defaults, version_id primary key, and foreign key to idea_versions with ON DELETE CASCADE. Canonical real TEST-Neon HTTP validation passed at b764450: simultaneous initial POSTs returned the same row; GET and repeat POST after fixture removal preserved the stored result, source excerpts and creation time. Unit SQL construction tests are not database validation. The E2E checks one stored row after simultaneous initial POSTs and frozen data/source_excerpts/created_at after repeat POST and GET. No feature-branch drizzle-kit push or production change is authorized.

