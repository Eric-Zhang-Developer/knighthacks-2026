# idea-scorecard-api schema on the shared test database, and grounding rules

Context: `specs/tech-stack.md` (#193) forbids `drizzle-kit push` from a feature branch on the shared test database.

Choice: applied this additive SQL, matching `db/schema/scorecard.ts`, to the test branch only:

```sql
create table if not exists scorecards (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references idea_versions(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists scorecards_version_created on scorecards (version_id, created_at);
```

Validation: the table did not exist before; afterwards it has those columns, the primary key, the cascading foreign
key and the index, and `tests/e2e/idea-scorecard-api/` passes against it.

Also decided here:
- Sources are the version's evidence cards, ensured with `createEvidence(…, false)` as snapshots do (top three
  neighbours, generating only missing cards). A point keeps only those ids; it is `supported` when it cites one,
  otherwise `inferred` (`unverified` stays). A criterion is `supported` only when every point cites a source.
- Originality points that cite no neighbour are dropped, so empty map space can't be a reason.
- A criterion with a null score, or with no point for or no point against after grounding, is `score: null` with
  `note: "evidence is insufficient"`.

How to undo: `drop table scorecards;` on the test branch. Production gets it through `db-sync`.
