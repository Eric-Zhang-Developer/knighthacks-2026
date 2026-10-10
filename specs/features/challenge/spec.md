---
name: Challenge my idea: one critic, one assumption, at most three rounds
depends_on: [idea-revisions]
owns: [app/api/challenge/, lib/challenge/, components/challenge/, db/schema/challenge.ts, tests/challenge/, tests/e2e/challenge/]
assignee: ""
---

# Challenge my idea (F09)

## Plan
1. User picks a perspective: user, judge or engineer.
2. Each round Gemini asks one question about one claim of the current version, naming the assumption and the
   evidence card or source it comes from.
3. The user answers; the round ends with `revise`, `gather evidence`, `test` or `answered well`.
4. `revise` opens revision suggestions with the challenge as context.

## Requirements
- Gemini calls go through `lib/ai/` (`generate`); labelled claims go through `checkClaims`.
- At most 3 rounds per session; the user starts a new session explicitly.
- A question with no named assumption, source or test is rejected and regenerated once, then the round ends.
- Never creates a version by itself.

## Validation
1. Start a challenge -> a question tied to a named assumption; answer -> an outcome; after 3 rounds -> ends.
2. Pick `revise` -> suggestions appear; accept -> a new version.
3. `tests/e2e/challenge/` covers 1–2; keep the session rows.

## Defaults
Neutral tone.
