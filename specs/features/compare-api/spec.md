---
name: Compare two or three versions on the rubric criteria
depends_on: [idea-revisions-api, neighbor-evidence-api]
owns: [app/api/compare/, lib/compare/, tests/compare-api/, tests/e2e/compare-api/]
assignee: ""
---

# Compare ideas (F16): API

Backend half (user decision 2026-10-10: backend is Windows). Windows workers first; a Mac worker may take it if it stays unclaimed for 15 minutes, so the backend chain never waits on one machine.

## Plan
1. `POST /api/compare` `{"versionIds": [2–3]}` -> `{"criteria": [{"name", "perVersion": [{"versionId", "reason": Claim, "uncertainty"}]}]}` on the rubric criteria (originality, technical depth, feasibility in the remaining time, design, wow), using each version's evidence cards.

## Requirements
- Gemini calls go through `lib/ai/` (`generate`); labelled claims go through `checkClaims`.
- No numeric win probability or score totals.
- Reasons cite evidence cards where they exist; otherwise they're labelled `inferred`.

## Validation
1. `POST` 2 versions -> every criterion has a reason per version and no number anywhere.
2. `tests/e2e/compare-api/` covers 1 (Gemini stubbed in the test only).

## Defaults
Criteria come from `specs/context/event.md`.
