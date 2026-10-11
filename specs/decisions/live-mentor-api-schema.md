# Live mentor additive schema

Context: the human removed application issuance/tool quotas on 2026-10-11; duplicate-call receipts still serialize across instances. The reviewed application schema is `db/schema/mentor.ts`; the legacy budget table is retained unused and the session table holds tool receipts. They never store provider capabilities or raw audio.

Choice: authenticated sessions are inserted directly; existing budget rows no longer block starts. Each session row serializes tool reservations, results and ending through guarded `UPDATE`. Session expiry matches the provider-supported two-hour maximum. Workspace deletion cascades both tables, and member deletion cascades that member's sessions. No additional indexes are declared; primary keys create PostgreSQL's implicit unique indexes.

The following is the complete CREATE SQL for a fresh database, matching the application schema. It does not upgrade existing tables. For an existing twenty-minute constraint, first apply the separately reviewed transaction in `live-mentor-api-demo-policy.md`; otherwise two-hour session insertion fails. The `schema-check.mjs --apply` command intentionally does not perform this upgrade. It assumes the existing `public.workspaces` and `public.members` tables. `IF NOT EXISTS` does not establish compatibility: the checker validates the actual existing column types, nullability, defaults, primary keys, foreign keys with cascade deletion, and check constraints after application.

```sql
CREATE TABLE IF NOT EXISTS public.mentor_budgets (
  workspace_id uuid PRIMARY KEY,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT mentor_budgets_workspace_id_workspaces_id_fk
    FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE,
  CONSTRAINT mentor_budget_bound CHECK (
    jsonb_typeof(events) = 'array'
    AND jsonb_array_length(events) <= 12
    AND octet_length(events::text) <= 4096
  )
);

CREATE TABLE IF NOT EXISTS public.mentor_sessions (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL,
  member_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  ended_at timestamp with time zone,
  calls jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT mentor_sessions_workspace_id_workspaces_id_fk
    FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE,
  CONSTRAINT mentor_sessions_member_id_members_id_fk
    FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE,
  CONSTRAINT mentor_session_duration CHECK (
    expires_at > created_at AND expires_at <= created_at + interval '2 hours'
  ),
  CONSTRAINT mentor_calls_bound CHECK (
    jsonb_typeof(calls) = 'object' AND octet_length(calls::text) <= 6291456
  ),
  CONSTRAINT mentor_sources_bound CHECK (
    jsonb_typeof(source_ids) = 'array'
    AND jsonb_array_length(source_ids) <= 200
    AND octet_length(source_ids::text) <= 10000
  )
);
```

Check an isolated database with `node tests/live-mentor-api/schema-check.mjs`. To apply this SQL explicitly and then check it, use `node tests/live-mentor-api/schema-check.mjs --apply`. Both require `TEST_DATABASE_URL`; neither reads or falls back to `DATABASE_URL`. Application is restricted to the two statements above, in one transaction. Existing incompatible tables are reported, never altered or repaired automatically.

How to undo: stop using the feature and retain the additive tables. Removing them or changing an existing incompatible table requires a separately reviewed database action. No production application or verification is implied by this decision file.
