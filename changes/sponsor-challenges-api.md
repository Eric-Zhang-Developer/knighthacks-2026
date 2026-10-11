## What shipped
Sponsor briefs: import pasted text and/or one PNG/JPEG, confirm an editable transcript and requirements as immutable revisions, then assess a saved idea with idempotent, reservation-backed assessments. The server re-checks every citation, keeps idea text as intent only, and computes rubric totals itself for quoted sums or weighted sums only.

## Where it lives
`app/api/sponsor-challenges/`, `lib/sponsor-challenges/` (contract, rubric, cite, extract, service, http), `db/schema/sponsor-challenges.ts`, `tests/sponsor-challenges-api/` (53 unit tests), `tests/e2e/sponsor-challenges-api/`, decisions `specs/decisions/sponsor-challenges-api-schema.md` and `-response.md` (frozen for the UI).

## How to check it
verify: `node scripts/verify.mjs sponsor-challenges-api /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/sponsor-challenges-api/20261011T110120Z` pass at 728990e (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/sponsor-challenges-api/20261011T110120Z). Stubbed models, test Neon. The rubric-overlay-api and decision-snapshot-api acceptance tests still pass.

## Gaps
- **Not release-ready: no live provider run (Validation 5).** Both Gemini keys are out of credit (#408) and Anthropic is blocked on #61. The live image and text assessment is still to do once a provider works (#170, #179).
- Tables are on the test branch only (db-sync); production needs the coordinated rollout (#113).
- No test proves share routes don't expose these tables, beyond nothing reading them.
- Confirm bodies are capped at 64 KiB by the shared JSON reader: a full 16,000-character transcript plus 50 long quotes could hit 413.
