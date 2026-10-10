---
name: Type an idea, correct its interpretation, and see it become a star among its neighbors
depends_on: [guest-workspace, search, galaxy]
owns: [app/api/ideas/, lib/ideas/, components/idea/, db/schema/ideas.ts, tests/idea-create/, tests/e2e/idea-create/]
assignee: ""
---

# Speak/type an idea (F03 text) + idea becomes a star (F04)

## Plan
1. Tables `ideas` and `idea_versions` (`parent_id`, `title`, `description`, `audience`, `problem`, `workflow`,
   `constraints`, `embedding`, `x/y/z`, `neighbor_ids`, `corpus_version`, `created_at`). Versions are insert-only.
2. `POST /api/ideas/interpret`: Gemini turns free text into those fields (JSON, zod-validated).
3. Idea card: input (reads `ideaDraft` from the store, so voice can fill it), shows the interpretation as
   editable fields, Save.
4. `POST /api/ideas`: embed, take neighbors through `lib/search/neighbors.ts`, place per decision D1, insert
   version 1. Sets `ideaStars` and `activeIdeaVersionId`.

## Requirements
- Nothing saves until the user presses Save; the interpretation is a preview.
- Reloading shows the same star at the same position, with the same corpus version.
- A Gemini failure keeps the typed text and lets the user fill fields by hand.
- Requests carry an idempotency key; a retried save makes no duplicate version.

## Validation
1. Type an idea -> fields appear; edit one; Save -> a cyan star appears with its neighbors highlighted.
2. Reload -> same star, same position.
3. `tests/e2e/idea-create/` covers 1–2 (Gemini stubbed in the test only), plus one live run noted in the done
   note. Keep the saved row.

## Defaults
5 neighbors. Gemini model from `GEMINI_MODEL`.
