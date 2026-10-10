# Windows backend claim

Worker: kiro-agent-1. Issue: #69. Base: 0053ffb, including the merged idea API and
explicit local production generation fixtures.

Follow this feature's canonical spec and the shared claim contract. Generate and
persist evidence for the saved version's real neighbors, preserve stored excerpts,
validate source membership, scope access to the authenticated workspace and reuse
persisted cards on subsequent requests. No invented corpus data or frontend work.

GPT-6 Astra implementation owns app/api/evidence/, lib/evidence/, db/schema/evidence.ts
and tests/neighbor-evidence-api/. Root owns tests/e2e/neighbor-evidence-api/, integration,
Git and GitHub. Independent GPT-6 Astra review follows the implementation. Local
acceptance uses the dedicated TEST_DATABASE_URL and generation fixtures only.
