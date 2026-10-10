-- Root operator only: additive setup on the dedicated test branch.
CREATE TABLE IF NOT EXISTS "combinations" (
  "version_id" uuid PRIMARY KEY REFERENCES "idea_versions"("id") ON DELETE CASCADE,
  "data" jsonb NOT NULL,
  "source_excerpts" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
