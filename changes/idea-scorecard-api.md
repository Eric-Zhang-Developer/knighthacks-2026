## What shipped
`POST /api/scorecard/:versionId` scores a saved idea version on the event's five criteria (Originality, Technical Understanding, Functionality, Design, Wow Factor), each on its own: a 1–5 score, points for and against, and a label; no total, no win chance. Points cite only the version's top-three evidence cards (generated if missing, as snapshots do) and are supported only when they cite one; originality points without a neighbour are dropped; a criterion missing a point either way is `null` with "evidence is insufficient". Insert-only; `GET` returns the newest.
## Where it lives
`app/api/scorecard/`, `lib/scorecard/` (contract, service), `db/schema/scorecard.ts`, `tests/idea-scorecard-api/`, `tests/e2e/idea-scorecard-api/`; test-branch SQL and grounding rules in `specs/decisions/idea-scorecard-api-schema.md`.
## How to check it
verify: `node scripts/verify.mjs idea-scorecard-api .git/agent-evidence/idea-scorecard-api/20261010T210906Z` pass at 7a5eda0 (Mac; Neon test branch; real save and neighbours; evidence and scorecard fixtures; rows kept).
## Gaps
Live run (Validation 2) not done: Gemini returns 429/402 (spending cap, credits depleted) for every call, #297; evidence generation fails live for the same reason. Production table comes through db-sync. No UI yet (idea-scorecard-ui).
