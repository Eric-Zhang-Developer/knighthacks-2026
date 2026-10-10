## What shipped
A "What would change your mind?" section in the Challenge panel for the active version. It loads a stored list on its own, or offers "List my assumptions" (one model call). Assumptions are grouped by kind (need, data, feasibility, differentiation), each with its claim badge and either "Check: …" / "Changes my mind if: …" or "Evidence is insufficient: nothing concrete would test this yet."
## Where it lives
`components/challenge/` (ChangeMind.tsx, change-mind.ts, index.tsx, challenge.module.css), `specs/decisions/change-mind-ui-trigger.md`, `tests/change-mind-ui/`, `tests/e2e/change-mind-ui/` (fixtures)
## How to check it
verify: `node scripts/verify.mjs change-mind-ui /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/change-mind-ui/20261010T170140Z` pass at 63b9160 (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/change-mind-ui/20261010T170140Z)
Run with `DATABASE_URL` = `TEST_DATABASE_URL`, `AI_STUB_DIR` a fresh absolute temp folder and `AI_STUB_ALLOW=1`. `tests/e2e/challenge-ui/` and `tests/e2e/prove-it-ui/` pass unchanged with the same setup.
## Gaps
- Assumptions are listed on request, not automatically on save (decision file); output is stubbed in e2e, no live model run.
- Needs the `assumptions` table on the main database (`specs/decisions/change-mind-api-schema.md`).
