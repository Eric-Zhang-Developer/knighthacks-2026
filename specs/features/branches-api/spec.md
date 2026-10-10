---
name: Suggest up to three directions and insert accepted ones as sibling versions
depends_on: [idea-revisions-api]
owns: [app/api/branches/, lib/branches/, tests/branches-api/, tests/e2e/branches-api/]
assignee: ""
---

# Branching futures (F25): API

Backend half (user decision 2026-10-10: backend is Windows). Windows workers first; a Mac worker may take it if it stays unclaimed for 15 minutes, so the backend chain never waits on one machine.

## Plan
1. `POST /api/branches/suggest` `{"versionId"}` -> `{"directions": [{"id", "title", "change"}]}` (up to 3, distinct).
2. `POST /api/branches/:directionId/accept` -> a sibling version (same parent), in the `idea-create-api` version shape. `POST /api/branches/manual` `{"versionId", fields}` -> a sibling copy with edits.

## Requirements
- Gemini calls go through `lib/ai/` (`generate`).
- A branch keeps its parent; no branch overwrites another.

## Validation
1. Suggest -> 3 directions; accept 2 -> 2 sibling rows with the same parent.
2. `tests/e2e/branches-api/` covers 1 (Gemini stubbed in the test only).

## Defaults
Branches are versions with a shared parent; no separate table.
