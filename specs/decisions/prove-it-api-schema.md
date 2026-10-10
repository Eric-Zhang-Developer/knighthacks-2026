# prove-it-api: applying the experiments table

**Context.** `drizzle-kit push` from a feature branch drops other features' tables on the shared database (#125).
**Choice.** Additive SQL, applied by hand to the test branch on 2026-10-10 and needed once on the main database:
```sql
create table if not exists experiments (
  id uuid primary key,
  session_id uuid not null,
  round integer not null,
  hypothesis text not null,
  procedure text not null,
  observable text not null,
  result text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint experiments_round_fk foreign key (session_id, round) references challenge_rounds (session_id, round) on delete cascade,
  constraint experiment_per_assumption unique (session_id, round),
  constraint experiment_result check (result is null or result in ('confirmed', 'refuted', 'inconclusive'))
);
```
It matches `db/schema/experiments.ts`. **How to undo.** `drop table experiments;` (nothing references it).
