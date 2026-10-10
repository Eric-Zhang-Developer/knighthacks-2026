-- Additive test-branch setup only; root operator applies after review. No production execution.
CREATE TABLE IF NOT EXISTS "rubric_overlays" (
  "version_id" uuid PRIMARY KEY REFERENCES "idea_versions"("id") ON DELETE CASCADE,
  "data" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "rubric_proofs" (
  "version_id" uuid NOT NULL REFERENCES "rubric_overlays"("version_id") ON DELETE CASCADE,
  "track_id" text NOT NULL,
  "proof" text,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("version_id", "track_id")
);
