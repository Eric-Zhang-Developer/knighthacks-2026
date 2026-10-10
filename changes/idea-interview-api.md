## What shipped
`POST /api/ideas/questions` with `{"fields": <interpret output>, "answers": [{question, field, answer}]}` returns `{"questions": [{field, question, why}], "done"}`: at most three questions, one per field (audience, problem, workflow, constraints, data, demo), most important first, each saying what the answer changes; `done` with no questions once every field has a specific answer, or after nine answers (three rounds) with no model call. Gemini through `lib/ai`; no database writes; 502 `{error}` on provider failure; same session and origin rules as interpret.
## Where it lives
`app/api/ideas/questions/`, `lib/interview/` (contract, service), `tests/idea-interview-api/`, `tests/e2e/idea-interview-api/`.
## How to check it
verify: `node scripts/verify.mjs idea-interview-api .git/agent-evidence/idea-interview-api/20261010T205555Z` pass at 60f24fc (Mac; generation fixtures; extras trimmed; nine answers end without a call). Live once (real Gemini): "an app for students" interpreted with problem and workflow null; questions asked about problem, workflow and data, each with a why; all six fields answered gave done with no questions.
## Gaps
Rounds are counted by answers (nine), so rounds with fewer questions allow more rounds. Whether a question assumes facts is a prompt rule, not checked by code. No UI yet (idea-interview-ui).
