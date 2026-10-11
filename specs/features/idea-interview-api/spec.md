---
name: Ask the user follow-up questions until the idea is understood
depends_on: [idea-create-api, ai-client]
owns: [app/api/ideas/questions/, lib/interview/, tests/idea-interview-api/, tests/e2e/idea-interview-api/]
assignee: ""
---

# Idea interview: API (#269)

Backend half: Windows workers first. A Mac worker may take it after 15 minutes unclaimed. User request 2026-10-10:
the assistant keeps asking questions so it never misunderstands the idea.

## Plan
1. `POST /api/ideas/questions` takes `{"fields": <interpret output>, "answers": [{"question", "field", "answer"}]}`.
   It returns `{"questions": [{"field", "question", "why"}], "done": boolean}`.
2. `field` is one of `audience`, `problem`, `workflow`, `constraints`, `data`, `demo`. A question targets a field
   that is null, vague, or contradicted by an earlier answer. At most 3 questions per call, most important first.
3. `done: true` when every field has a specific answer, or after 3 rounds.

## Requirements
- Gemini goes through `lib/ai/`. No database writes. 502 `{"error"}` on provider failure.
- A question never assumes facts the user hasn't given. `why` says what the answer will change.
- Text and voice call this same route.

## Validation
1. Vague text ("an app for students") → `interpret` → `questions` asks about `problem` and `workflow` at least.
2. Answers covering every field → `done: true` and no questions.
3. `tests/e2e/idea-interview-api/` covers 1–2 with Gemini stubbed, plus one live run noted in the done note.

## Defaults
3 rounds maximum. If unsure, ask about `problem` first.
Rounds are counted by answers: nine answers (three rounds of three) end the interview with `done: true` and no model
call, because the route stores nothing between calls. The model may return up to six questions; the server keeps the
first per field, at most three, and `done` is true exactly when no questions are returned.
