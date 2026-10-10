---
name: Challenge my idea: one critic, one assumption, at most three rounds
depends_on: [challenge-api, idea-revisions-ui]
owns: [components/challenge/, tests/challenge-ui/, tests/e2e/challenge-ui/]
assignee: ""
---

# Challenge my idea (F09): UI

Frontend half: Mac workers only (user decision 2026-10-10). Build against the response shape pinned in `challenge-api`; the routes exist once it is done.

## Plan
1. Pick a perspective, then question, answer and outcome per round.
2. `revise` opens revision suggestions with the challenge as `context`.

## Requirements
- The assumption and its source show with every question.
- After round 3 the panel offers a new session only.

## Validation
1. Start a challenge -> a question tied to a named assumption; answer -> an outcome; after 3 rounds -> ends.
2. Pick `revise` -> suggestions appear; accept -> a new version.
3. `tests/e2e/challenge-ui/` covers 1–2; keep a screenshot.

## Defaults
Perspective defaults to judge.
