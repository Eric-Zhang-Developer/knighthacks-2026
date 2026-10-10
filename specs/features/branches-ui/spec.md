---
name: Branch an idea into up to three directions
depends_on: [branches-api, idea-revisions-ui]
owns: [components/branches/, tests/branches-ui/, tests/e2e/branches-ui/]
assignee: ""
---

# Branching futures (F25): UI

Frontend half: Mac workers only (user decision 2026-10-10). Build against the response shape pinned in `branches-api`; the routes exist once it is done.

## Plan
1. Suggest, accept, or branch manually; the trail shows branches side by side; each is selectable.

## Requirements
- Each branch's star is visible in the galaxy (through `ideaStars`); selection happens in the trail, so this half needs no change to `components/galaxy/`.

## Validation
1. Suggest -> 3 directions; accept 2 -> 2 sibling stars; select each -> its details.
2. `tests/e2e/branches-ui/` covers 1.

## Defaults
Branches sit beside their parent in the trail.
