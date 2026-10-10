---
name: Compare two or three idea versions on explicit criteria
depends_on: [compare-api, idea-revisions-ui]
owns: [components/compare/, tests/compare-ui/, tests/e2e/compare-ui/]
assignee: ""
---

# Compare ideas (F16): UI

Frontend half: Mac workers only (user decision 2026-10-10). Build against the response shape pinned in `compare-api`; the routes exist once it is done.

## Plan
1. Pick 2–3 versions; a table: per criterion, a short reason (with its label) and an uncertainty note.

## Requirements
- No numbers, bars or totals that read as a score.

## Validation
1. Select 2 versions -> the table with reasons per criterion. `tests/e2e/compare-ui/` covers it.

## Defaults
Versions as columns, criteria as rows.
