## What shipped
`POST /api/rehearsal/:versionId` with `{"built": [...]}` (1–8 items, ≤120 characters) drafts a pitch of at most 90 words and exactly three judge questions; `GET` returns the newest one for the version. A sentence stays `built` only if it contains a built item exactly, otherwise it is `planned`; question bases are `supported` only when they quote a version field or built item. Stored per version and sorted built list: repeating the POST, in any order, reads the row with no model call. Two questions (or over 90 words) → one retry → 502, nothing stored.
## Where it lives
`app/api/rehearsal/`, `lib/rehearsal/` (contract, service), `db/schema/rehearsal.ts`, `tests/rehearsal-api/`, `tests/e2e/rehearsal-api/`; test-branch SQL and decisions in `specs/decisions/rehearsal-api-schema.md`.
## How to check it
verify: `node scripts/verify.mjs rehearsal-api .git/agent-evidence/rehearsal-api/20261010T192247Z` pass at 4196b0b (Mac; Neon test branch; fixtures with AI_STUB_ALLOW=1; stored rows kept). Live once on the test branch (real Gemini): 200, 51 words, 3 questions; both built sentences contain their item, three others planned.
## Gaps
Production table comes through db-sync. The retry count for Validation 3 is pinned in `tests/ai-client/generate.test.ts`; the e2e checks the resulting 502 and empty table. No UI yet (rehearsal-ui, #247).
