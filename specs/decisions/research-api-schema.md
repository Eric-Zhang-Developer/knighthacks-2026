# research-api schema on the shared test database

Context: `specs/tech-stack.md` (shared database schema safety) forbids `drizzle-kit push` from a feature branch.

Choice: applied this additive SQL, matching `db/schema/research.ts`, to the test branch only:

```sql
create table if not exists research (
  version_id uuid primary key references idea_versions(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);
```

Validation: the table did not exist before; afterwards it has `version_id uuid`, `data jsonb`, `created_at timestamptz`,
`research_pkey` and `research_version_id_fkey`, and `tests/e2e/research-api/` passes against it.

Also decided here: a search result the classifier doesn't return a kind for is left out (a `kind` and `reason` are
required, and inventing one would be unsourced). Any non-OK answer from a source (not only 403/429), or a timeout
(status 0), lists that source in `unavailable`. Tests point the search calls at recorded responses with
`RESEARCH_SEARCH_BASE`, honoured only under the AI fixture opt-in and never on Vercel.

How to undo: `drop table research;` on the test branch. Production is applied separately (#113).
