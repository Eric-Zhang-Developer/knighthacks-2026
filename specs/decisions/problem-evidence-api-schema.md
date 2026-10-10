# Per-version evidence on the shared test branch

Context: results are immutable per saved version; grounding metadata must remain auditable. The existing test database had no `problem_evidence` table at preflight.
Choice: one additive table, matching `db/schema/problem-evidence.ts`, with the public response in `data` and the actual normalized Gemini grounding response in `grounding`. No new dependency, migration framework, or whole-schema push.

```sql
CREATE TABLE IF NOT EXISTS problem_evidence (
  version_id uuid PRIMARY KEY REFERENCES idea_versions(id) ON DELETE CASCADE,
  grounding jsonb NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Apply only to TEST_DATABASE_URL. Validate column types/nullability/default, primary key and cascading foreign key against the schema; retain test rows. Production application is separately coordinated in #113 after merge and is not authorized by this feature. Undo: revert the feature; leave the unused additive table in place pending owner-approved cleanup.

Validation on 2026-10-10: queried information_schema.columns and pg_constraint; UUID primary key, two non-null jsonb columns, non-null timestamptz default now(), and cascading FK to idea_versions(id) all matched. No existing table was altered.
