# change-mind-api: the assumptions table and the one regeneration

**Schema.** `drizzle-kit push` from a feature branch drops other features' tables (#125), so the table was added with
additive SQL on the test branch on 2026-10-10; the main database needs the same once:
```sql
create table if not exists assumptions (
  version_id uuid primary key references idea_versions (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);
```
**Regeneration.** The spec asks that a malformed item be "rejected and regenerated once by `generate`, then dropped".
`generate` already retries once when validation fails, so `generatedSchema()` counts its own parses: the first
rejects any item without exactly one of a usable reversal or `insufficient`, which makes `generate` ask again; the
second keeps the well-formed items and drops the rest. Options were a second explicit `generate` call (two more model
calls with fallback) or this. If nothing usable is left, the POST is a 502 and nothing is stored, so a retry can work.
**How to undo.** `drop table assumptions;`. For the regeneration, make `generatedSchema()` always strict and filter in
the service instead.
