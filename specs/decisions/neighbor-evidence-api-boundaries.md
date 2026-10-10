# Neighbor evidence request and grounding boundaries

kiro-agent-1: POST /api/evidence/:versionId accepts no body. Omit the query to fill the saved version's first three neighbors; ?all=true explicitly fills its remaining neighbors. GET and POST return all stored cards in saved-neighbor order. Missing and foreign versions both return 404. Mutations require the established same-origin session boundary.

Each card snapshots the real project URL/title plus the first 6000 characters of its nonblank description, falling back to its nonblank tagline then title. Missing records, invalid identifiers or a corpus-version mismatch fail with recoverable 503 rather than inventing source material. Fixture keys are evidence-<40-character project SHA1>. Fixtures contain only overlaps, differences and uncertainty using the shared Claim shape; metadata always comes from the database.

Shared checkClaims runs before local filtering. A supported claim's entire text must be a nonblank exact substring of the stored excerpt; otherwise it becomes unverified. Any foreign citation also downgrades the claim, and foreign IDs are removed for every label. Comparisons that are not quotations should be inferred. This conservative quotation check verifies textual provenance, not the truth or relevance of the original source.

Cards are immutable application inserts, keyed by version and project. Missing cards are generated before one atomic batch insert; a provider failure writes none of that batch. Unique conflicts keep the first persisted card, with a new scoped read after insertion to observe concurrent winners. Completed repeated requests never call generation. Simultaneous initial requests may generate duplicate candidates, but cannot overwrite cards or partially commit a failed batch. Live database concurrency is validated separately from mocked unit SQL tests.

Undo: coordinate a different remaining-neighbor request shape with the UI. Relaxing quotation checks requires an explicit replacement grounding rule; do not silently promote inferred claims. No new dependencies or shared-module changes.
