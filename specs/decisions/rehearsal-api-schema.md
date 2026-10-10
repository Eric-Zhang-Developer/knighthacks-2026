# rehearsal-api schema on the shared test database

Context: `specs/tech-stack.md` (#193) forbids `drizzle-kit push` from a feature branch on the shared test database.

Choice: applied this additive SQL, matching `db/schema/rehearsal.ts`, to the test branch only:

```sql
create table if not exists rehearsals (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references idea_versions(id) on delete cascade,
  built_hash text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  constraint rehearsals_version_built unique (version_id, built_hash)
);
```

Validation: the table did not exist before; afterwards it has those columns, the primary key, the cascading foreign key
and the unique constraint, and `tests/e2e/rehearsal-api/` passes against it.

Also decided here: a pitch sentence is `built` only when the model marked it so and it contains a built item exactly
(case included); the server only ever downgrades. The built list is hashed sorted, so order doesn't make a new
rehearsal. Each `basis` is grounded with `moment-api`'s `groundClaim` against the version's fields and the built items.

How to undo: `drop table rehearsals;` on the test branch. Production gets it through `db-sync`.
