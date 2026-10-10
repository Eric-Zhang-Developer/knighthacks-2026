---
name: Type an idea, correct its interpretation, and see it become a star among its neighbors
depends_on: [idea-create-api, galaxy, guest-workspace-ui]
owns: [components/idea/, tests/idea-create-ui/, tests/e2e/idea-create-ui/]
assignee: ""
---

# Speak/type an idea (F03 text) + idea becomes a star (F04): UI

Frontend half: Mac workers only (user decision 2026-10-10). Build against the response shape pinned in `idea-create-api`; the routes exist once it is done.

## Plan
1. Idea card: input (reads `ideaDraft` from the store, so voice can fill it), shows the interpretation as editable fields, Save.
2. On save, set `ideaStars`, `activeIdeaVersionId` and `highlightedIds` (the neighbors).

## Requirements
- Nothing saves until the user presses Save; the interpretation is a preview.
- A Gemini failure keeps the typed text and lets the user fill fields by hand.
- Reload restores the star from `GET /api/ideas`.

## Validation
1. Type an idea -> fields appear; edit one; Save -> a cyan star appears with its neighbors highlighted.
2. Reload -> same star, same position.
3. `tests/e2e/idea-create-ui/` covers 1–2 (Gemini stubbed in the test only). Keep a screenshot.

## Defaults
Cyan for the active idea, per the galaxy spec.
