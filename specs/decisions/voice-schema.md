# Voice token reservations (#219)

An in-memory limit does not hold across Vercel instances. Use one Postgres row per existing member session,
with an atomic upsert admitting 10 mint attempts in a 60-second window beginning with the first attempt.
Failed provider requests count; missing configuration does not. A denied request conservatively retries in
60 seconds. The foreign key deletes the counter when its member/workspace is deleted; no session credentials
or audio are stored. A rolling log was rejected because it adds retention and locking complexity.

Additive SQL for the dedicated test branch only, matching `db/schema/voice.ts`:

```sql
CREATE TABLE IF NOT EXISTS voice_token_limits (
  member_id uuid PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  window_started_at timestamp with time zone NOT NULL,
  attempts integer NOT NULL,
  CONSTRAINT voice_token_attempts_range CHECK (attempts BETWEEN 1 AND 10)
);
```

Inspect `information_schema.columns` and `pg_constraint` after application to confirm the existing shape,
primary key, foreign key/cascade, and check constraint. Run concurrent reservation, expiry, isolation and
cascade tests on the dedicated test branch. Production application requires its separately approved schema
operation; until the table exists the endpoint returns 503 and spends no provider tokens. Rollback the code
without dropping the table; drop this isolated table only through an explicitly approved cleanup.

Validation on 2026-10-10: root reviewed this SQL before test-only application. Exact columns, primary key,
member foreign key with cascade, and attempts check all matched. The real-Neon regression admitted exactly
10 of 20 concurrent reservations in both initial and expired windows, preserved a teammate's independent
allowance, denied exhausted retries, and left zero counters after deleting only the created test workspace.
