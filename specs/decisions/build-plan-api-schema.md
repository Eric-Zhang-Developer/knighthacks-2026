# Build-plan test schema

Context: shared-test safety forbids whole-schema pushes from feature branches. Reviewed additive SQL matches `db/schema/plan.ts`:

```sql
create table if not exists build_plans (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null,
  request jsonb not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  constraint build_plans_version_id_idea_versions_id_fk foreign key (version_id) references idea_versions(id) on delete cascade
);
```

Applied only to TEST_DATABASE_URL after confirming its host differs from production. The table was absent; exact columns, nullability, defaults, primary key and cascading foreign key then passed catalog validation. PostgreSQL 18 also catalogs NOT NULL constraints; those were verified through column nullability. Application inserts only; workspace deletion cascades test rows. Production application remains separately coordinated under #113.

Undo: remove this feature's test table only after coordinating with its consumers; no rollback SQL runs automatically.
