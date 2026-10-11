# Decision context: schema

Context: team profiles, scope recommendations and selections need storage. Everything is append-only, and revisions
are checked atomically.

Options: A) one table per kind with unique revision keys (chosen); B) one generic `decision_events` table; C) store
the profile on the workspace row (not owned here, and not append-only).

Choice: A. All three are defined in `db/schema/decision-context.ts` and applied with `scripts/db-sync.mjs`, which
only creates, never drops or alters. There are no destructive statements and no edits to existing tables.

```sql
CREATE TABLE "team_profiles" ("id" uuid PRIMARY KEY NOT NULL, "workspace_id" uuid NOT NULL, "revision" integer NOT NULL,
  "profile" jsonb NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "team_profile_revision" UNIQUE("workspace_id","revision"),
  CONSTRAINT "team_profile_revision_positive" CHECK ("team_profiles"."revision" > 0));
CREATE TABLE "scope_recommendations" ("id" uuid PRIMARY KEY NOT NULL, "version_id" uuid NOT NULL,
  "profile_revision" integer NOT NULL, "profile" jsonb, "features" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE "scope_selections" ("id" uuid PRIMARY KEY NOT NULL, "version_id" uuid NOT NULL, "recommendation_id" uuid NOT NULL,
  "revision" integer NOT NULL, "choices" jsonb NOT NULL, "demo_sketch" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "scope_selection_revision" UNIQUE("version_id","revision"),
  CONSTRAINT "scope_selection_revision_positive" CHECK ("scope_selections"."revision" > 0));
-- foreign keys, all ON DELETE CASCADE: team_profiles.workspace_id -> workspaces, scope_recommendations.version_id ->
-- idea_versions, scope_selections.version_id -> idea_versions, scope_selections.recommendation_id -> scope_recommendations
```

Shape checks: `PUT /profile` and `POST /selections` insert `revision = expected + 1` only when the current maximum
equals `expected`, in one statement. Two concurrent writers both pass that check, and the unique key rejects the second
(23505), which the API returns as 409.

Applied to the test branch only (`DATABASE_URL=$TEST_DATABASE_URL node scripts/db-sync.mjs --apply`). Production:
db-sync from a clean `origin/main` after merge, under the existing database safety contract (#113). Not run here.

How to undo: the tables are new and nothing else reads them except the snapshot statement's optional `scope` key.
Revert the PR, then drop the three tables on the test branch.
