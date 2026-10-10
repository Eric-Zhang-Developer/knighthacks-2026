## What shipped
`POST /api/experiments {sessionId, round}` drafts a ten-minute experiment (hypothesis, procedure, observable) from a challenge round whose outcome is `test`, through `lib/ai/`; any other outcome is 409, and asking again returns the same experiment (one per assumption). `PATCH /api/experiments/:id` edits the three parts or records `confirmed`/`refuted`/`inconclusive` with a note, never both. `GET /api/experiments?versionId=` lists them with the hypothesis as an `unverified` claim and `result: null` until the user records one. Workspace and same-origin rules match challenge; nothing writes idea versions.
## Where it lives
`app/api/experiments/`, `lib/experiments/`, `db/schema/experiments.ts`, `specs/decisions/prove-it-api-schema.md` (the SQL), `tests/prove-it-api/`, `tests/e2e/prove-it-api/`
## How to check it
verify: `node scripts/verify.mjs prove-it-api /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/prove-it-api/20261010T151101Z` pass at d17c0d5 (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/prove-it-api/20261010T151101Z)
Run with `DATABASE_URL` = `TEST_DATABASE_URL`, `AI_STUB_DIR` a fresh absolute temp folder and `AI_STUB_ALLOW=1`. The stored row is `experiment-row.json` in the evidence. Removing the outcome guard makes the e2e fail (201 instead of 409).
## Gaps
- The `experiments` table exists only on the test branch; the main database needs the SQL in `specs/decisions/prove-it-api-schema.md` (#125, #113).
- The draft is stubbed in e2e; no live model run. "Fits in ten minutes" is asked for in the prompt and bounded by length, not checked.
