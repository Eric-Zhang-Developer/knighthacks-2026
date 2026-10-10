## What shipped
A "Challenge my idea" panel. Pick a critic (judge by default, or user or engineer). Each round shows one question with its named assumption and its source as a claim badge (supported with the quote, or unverified with a proposed test). The user answers and gets an outcome. A "Revise the idea" outcome offers revision suggestions with the challenge as context; accepting one makes the next version and moves the idea's star. After round 3, the only action left is "New challenge".
## Where it lives
`components/challenge/` (index.tsx, rounds.ts, challenge.module.css), `tests/challenge-ui/`, `tests/e2e/challenge-ui/` (fixtures)
## How to check it
verify: `node scripts/verify.mjs challenge-ui /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/challenge-ui/20261010T142532Z` pass at 4619177 (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/challenge-ui/20261010T142532Z)
Run with `DATABASE_URL` set to the Neon test branch, `AI_STUB_DIR` set to a fresh absolute temp folder (the test copies its fixtures in and writes round 1's from a real neighbor) and `AI_STUB_ALLOW=1`. The test was confirmed to fail if a fourth round were offered. 23 neighboring e2e tests pass.
## Gaps
- Critic questions and outcomes are stubbed in the e2e; this hasn't been run with live Gemini (#61).
- A session is kept only in the page: reloading starts over, though the server keeps the session rows.
