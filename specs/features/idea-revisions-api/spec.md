---
name: Propose revisions and create a new version only on accept
depends_on: [idea-create-api]
owns: [app/api/revisions/, lib/revisions/, db/schema/revisions.ts, tests/idea-revisions-api/, tests/e2e/idea-revisions-api/]
assignee: ""
---

# Guided refinement (F06) + revision trail (F07): API

Backend half (user decision 2026-10-10: backend is Windows). Windows workers first; a Mac worker may take it if it stays unclaimed for 15 minutes, so the backend chain never waits on one machine.

## Plan
1. `POST /api/revisions/propose` `{"versionId", "context"?}` -> `{"suggestions": [{"id", "field", "change", "reason"}]}`: up to 3 specific changes (audience, workflow, constraint or interaction).
2. `POST /api/revisions/:suggestionId/accept` -> a new `idea_versions` row whose parent is the current version, re-embedded and re-placed; returns the `idea-create-api` version shape. `.../reject` -> no write.
3. `GET /api/revisions/trail/:ideaId` -> versions with `parentId`, oldest first.

## Requirements
- Gemini calls go through `lib/ai/` (`generate`).
- Accepting is the only way a version is created here; reject changes nothing in the database.
- Concurrent accepts on the same parent both survive, as sibling versions.

## Validation
1. Propose -> suggestions; reject one -> no new row; accept one -> a new row whose parent is version 1.
2. Two accepts at once on one parent -> two sibling rows.
3. `tests/e2e/idea-revisions-api/` covers 1–2; keep the rows.

## Defaults
`context` is free text, such as a challenge outcome.
