## What shipped
After an idea is interpreted, the check step asks `POST /api/ideas/questions`' follow-ups inline. Each question has its reason and an answer field. "Use my answers" appends the Q/A lines to the idea text and re-reads it, then the next round runs until `done`. "Skip and save" and Save always work, and a missing route (404) hides the interview silently. A spoken answer fills the last focused answer field.
## Where it lives
`components/interview/` (index.tsx, interview.ts, CSS), `components/idea/index.tsx`, `specs/decisions/idea-interview-ui-voice.md`, `tests/idea-interview-ui/`, `tests/e2e/idea-interview-ui/` (fixtures)
## How to check it
verify: `node scripts/verify.mjs idea-interview-ui /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/idea-interview-ui/20261010T210127Z` pass at 6791331 (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/idea-interview-ui/20261010T210127Z)
Run with `DATABASE_URL` = `TEST_DATABASE_URL`, `AI_STUB_DIR` a fresh absolute temp folder of its own, `AI_STUB_ALLOW=1`. `tests/e2e/idea-create-ui/` and `tests/e2e/voice/` pass unchanged. Run alone, though: sharing a stub folder with this suite swaps the interpret fixture.
## Gaps
- The questions route is stubbed in the browser (idea-interview-api, #290, isn't merged); no live model run.
- Voice-to-answer routing is unit-tested (`spokenDelta`) but not in e2e; questions are shown, not spoken (decision file).
