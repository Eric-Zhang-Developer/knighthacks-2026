---
name: Run bounded challenge sessions about one assumption at a time
depends_on: [idea-revisions-api]
owns: [app/api/challenge/, lib/challenge/, db/schema/challenge.ts, tests/challenge-api/, tests/e2e/challenge-api/]
assignee: ""
---

# Challenge my idea (F09): API

Backend half (user decision 2026-10-10: backend is Windows). Windows workers first; a Mac worker may take it if it stays unclaimed for 15 minutes, so the backend chain never waits on one machine.

## Plan
1. `POST /api/challenge` `{"versionId", "perspective": "user" | "judge" | "engineer"}` -> a session.
2. `POST /api/challenge/:sessionId/round` -> `{"round", "question", "assumption", "source": Claim}`: one question about one claim of the current version, naming the assumption and the evidence card or source.
3. `POST /api/challenge/:sessionId/answer` `{"answer"}` -> `{"outcome": "revise" | "gather evidence" | "test" | "answered well"}`.

## Requirements
- Gemini calls go through `lib/ai/` (`generate`); labelled claims go through `checkClaims`.
- At most 3 rounds per session (a 4th returns 409); the user starts a new session explicitly.
- A question with no named assumption, source or test is rejected and regenerated once, then the round ends.
- Never creates a version by itself.

## Validation
1. Start a session -> a question tied to a named assumption; answer -> an outcome; a 4th round -> 409.
2. `tests/e2e/challenge-api/` covers 1 (Gemini stubbed in the test only); keep the session rows.

## Defaults
Neutral tone.
