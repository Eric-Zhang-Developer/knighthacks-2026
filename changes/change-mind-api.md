## What shipped
`POST /api/assumptions/:versionId` lists, through `lib/ai/`, the assumptions a saved version rests on (need, data, feasibility, differentiation; at most 6, 2 per kind) from its fields, evidence cards and challenge rounds. Each has a reversal (`observe`, `reversesIf`) or `insufficient: true`, never both and never neither. A malformed or hedged item makes `generate` regenerate once and is then dropped. Claims cite only the version's evidence-card projects. Stored per version, so a second `POST`, and `GET`, return the row with no model call.
## Where it lives
`app/api/assumptions/`, `lib/assumptions/`, `db/schema/assumptions.ts`, `specs/decisions/change-mind-api-schema.md`, `tests/change-mind-api/`, `tests/e2e/change-mind-api/`
## How to check it
verify: `node scripts/verify.mjs change-mind-api /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/change-mind-api/20261010T164159Z` pass at e8ca0e3 (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/change-mind-api/20261010T164159Z)
Run with `DATABASE_URL` = `TEST_DATABASE_URL`, `AI_STUB_DIR` a fresh absolute temp folder and `AI_STUB_ALLOW=1`. The stored row is `assumptions-row.json`. Treating every item as well-formed makes the e2e fail (200 instead of 502).
## Gaps
- The `assumptions` table exists only on the test branch; the main database needs the SQL in the decision file (#125).
- Falsifiability is checked by structure and a hedge list only; output is stubbed in e2e, no live model run.
