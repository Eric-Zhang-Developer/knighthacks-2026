---
name: Branch an idea into up to three directions
depends_on: [idea-revisions]
owns: [app/api/branches/, lib/branches/, components/branches/, tests/branches/, tests/e2e/branches/]
assignee: ""
---

# Branching futures (F25)

## Plan
1. `POST /api/branches/suggest`: up to 3 distinct directions from the current version.
2. Accepting one inserts a sibling version (same parent). Manual branch: copy the version and edit.
3. The trail shows branches side by side; each is selectable.

## Requirements
- Gemini calls go through `lib/ai/` (`generate`).
- A branch keeps its parent; no branch overwrites another.

## Validation
1. Suggest -> 3 directions; accept 2 -> 2 sibling stars; select each -> its details.
2. `tests/e2e/branches/` covers 1.

## Defaults
Branches are versions with a shared parent; no separate table.
