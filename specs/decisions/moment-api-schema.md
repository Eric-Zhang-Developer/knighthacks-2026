# moment-api schema on the shared test database

Context: `specs/tech-stack.md` (#193) forbids `drizzle-kit push` from a feature branch on the shared test database.

Choice: applied this additive SQL, matching `db/schema/moment.ts`, to the test branch only:

```sql
create table if not exists moments (
  version_id uuid primary key references idea_versions(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);
```

Validation: the table did not exist before; afterwards its columns are `version_id uuid`, `data jsonb`, `created_at
timestamptz` with the primary key and the cascading foreign key, and `tests/e2e/moment-api/` passes against it.

How to undo: `drop table moments;` on the test branch. Production is applied separately (#113).
