# Idea creation boundaries and placement

Context: the feature specifies six nullable fields, five neighbors and immutable saved placement, but leaves input limits and incomplete corpus behavior open.

Choice (kiro-agent-1): require all six fields as nullable strings; title is at most 200 characters, others 4000. Save requires at least one nonblank value; interpret accepts 1–8000 characters of nonblank text. JSON envelopes are capped at 65536 bytes while reading. Idempotency keys are 1–128 ASCII letters, digits, dots, underscores, colons or hyphens, scoped to the authenticated workspace. A repeated key returns its original version even if the caller changes fields; clients must use a new key for a new idea.

Placement requires exactly five distinct cosine neighbors with finite stored coordinates and one nonempty corpus version. Missing or inconsistent placement returns a recoverable 503 and writes nothing. D1 uses the mean of their coordinates, never coordinate distance for similarity. The saved row retains that placement even after corpus changes. Embeddings use the existing shared HF helper; invalid dimensions or nonfinite/zero vectors fail safely.

An atomic CTE inserts the idea and its initial version together. The workspace/key unique constraint arbitrates concurrent saves. A loser reads the committed original version in a subsequent statement rather than relying on a snapshot that predates the winner. Versions are never updated by this feature. GET returns an array, selecting the latest version per idea; POST returns one version (201 for creation, 200 for reuse).

Undo: adjust these local validators and placement guards with corresponding tests. Changing idempotency semantics requires coordinating clients to avoid unintended duplicates. Unit SQL-contract tests are not live database concurrency evidence; real Neon/HF/provider validation remains separate.
