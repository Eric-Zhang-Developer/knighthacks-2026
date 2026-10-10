---
name: Answer the assistant's questions before the idea is saved
depends_on: [idea-create-ui]
owns: [components/interview/, components/idea/, tests/idea-interview-ui/, tests/e2e/idea-interview-ui/]
assignee: ""
---

# Idea interview: UI (#269)

Frontend: Mac workers. After the user types or speaks an idea and it's interpreted, the composer asks the
interview's questions before saving version 1. It doesn't wait for idea-interview-api: build against a stubbed
`POST /api/ideas/questions` using that spec's contract. When the route is missing (404), the panel skips the
interview silently and saves as today. Design reference: the phone "Live with Uncharted" screen in
`docs/design-references/` (chat bubbles, suggestion chips, mic).

## Plan
1. After `interpret`, show the questions from `/api/ideas/questions`, one per row, each with its `why` and a text
   answer field. A Skip button saves as today.
2. Answers are appended to the idea text and re-interpreted; then the next round runs, until `done` or Skip.
3. Voice: the same questions are read into the composer, and a spoken answer fills the focused field (the voice
   transcript path already used by idea-create-ui).

## Requirements
- Skip always works. The interview never blocks saving.
- With the microphone denied, the whole interview works by text.
- The idea-create-ui and voice e2e suites still pass.

## Validation
1. Type a vague idea → questions appear. Answer them → the interpreted fields show the answers. Save → version 1
   carries them.
2. Skip → it saves immediately, as before.
3. `tests/e2e/idea-interview-ui/` covers 1–2 with a stubbed route. Keep a screenshot.

## Defaults
Show questions inline in the idea panel, not in a modal.
