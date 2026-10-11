# Sponsor challenges: schema

Context: imported briefs, their confirmed revisions and assessments need private storage, plus an idempotency
reservation that a late provider result can't overwrite or resurrect.

Options: A) three tables, with the assessment row doubling as the idempotency reservation (chosen); B) a separate
reservations table joined to results; C) one jsonb document per brief, rewritten on each change (not immutable).

Choice: A. Defined in `db/schema/sponsor-challenges.ts`. One row per `(workspace_id, idempotency_key)`, inserted as
`pending` before generation. Its result is written only by
`update ... where id = $1 and status = 'pending' and expires_at > now()`, so a deleted brief (the row is gone) or an
expired key (now `expired`) stays that way. Raw image bytes are never stored, only `draft.source.image =
{ mediaType, sha256 }`. Everything cascades from `workspaces`, and assessments also cascade from the brief, the
revision and the idea version.

```sql
CREATE TABLE "sponsor_challenges" ("id" uuid PRIMARY KEY NOT NULL, "workspace_id" uuid NOT NULL, "draft" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE "sponsor_challenge_revisions" ("id" uuid PRIMARY KEY NOT NULL, "challenge_id" uuid NOT NULL, "revision" integer NOT NULL,
  "transcript" text NOT NULL, "requirements" jsonb NOT NULL, "rubric" jsonb, "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sponsor_challenge_revision" UNIQUE("challenge_id","revision"),
  CONSTRAINT "sponsor_challenge_revision_positive" CHECK ("sponsor_challenge_revisions"."revision" > 0));
CREATE TABLE "sponsor_challenge_assessments" ("id" uuid PRIMARY KEY NOT NULL, "workspace_id" uuid NOT NULL, "challenge_id" uuid NOT NULL,
  "revision_id" uuid NOT NULL, "version_id" uuid NOT NULL, "idempotency_key" text NOT NULL, "input_hash" text NOT NULL,
  "evidence" jsonb NOT NULL, "status" text NOT NULL, "data" jsonb, "error" text, "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sponsor_challenge_assessment_key" UNIQUE("workspace_id","idempotency_key"),
  CONSTRAINT "sponsor_challenge_assessment_status" CHECK ("sponsor_challenge_assessments"."status" in ('pending', 'complete', 'failed', 'expired')));
-- foreign keys, all ON DELETE CASCADE: sponsor_challenges.workspace_id -> workspaces; revisions.challenge_id ->
-- sponsor_challenges; assessments.workspace_id -> workspaces, .challenge_id -> sponsor_challenges,
-- .revision_id -> sponsor_challenge_revisions, .version_id -> idea_versions
CREATE INDEX "sponsor_challenges_workspace" ON "sponsor_challenges" USING btree ("workspace_id","created_at");
CREATE INDEX "sponsor_challenge_assessments_challenge" ON "sponsor_challenge_assessments" USING btree ("challenge_id","created_at");
```

Applied to the test branch only with `scripts/db-sync.mjs --apply` (DATABASE_URL = TEST_DATABASE_URL). Its plan was
exactly these 11 statements (3 tables, 6 foreign keys, 2 indexes), with no drift and nothing on any existing table. A
second dry run printed `nothing to apply`. Production: db-sync from a clean `origin/main` after merge, under #113.
Not run here.

Expiry: `RESERVATION_MS` = 300 s. That's longer than one `generate()` call (provider timeouts of 60 s and 30 s plus
one fallback) and Vercel's 300 s function limit, so a live owner is never treated as abandoned. An expired
reservation turns `expired` when it is next read; nothing regenerates it.

How to undo: nothing outside this feature reads these tables. Revert the PR, then drop the three tables on the test
branch.
