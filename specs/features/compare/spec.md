---
name: Compare two or three idea versions on explicit criteria
depends_on: [idea-revisions]
owns: [app/api/compare/, lib/compare/, components/compare/, tests/compare/, tests/e2e/compare/]
assignee: ""
---

# Compare ideas (F16)

## Plan
1. Pick 2–3 versions; Gemini compares them on the rubric criteria (originality, technical depth, feasibility
   in the remaining time, design, wow) using each version's evidence cards.
2. Show a table: per criterion, a short reason and an uncertainty note.

## Requirements
- Gemini calls go through `lib/ai/` (`generate`); labelled claims go through `checkClaims`.
- No numeric win probability or score totals.
- Reasons cite evidence cards where they exist; otherwise they're labelled `inferred`.

## Validation
1. Select 2 versions -> the table with reasons per criterion. `tests/e2e/compare/` covers it.

## Defaults
Criteria come from `specs/context/event.md`.
