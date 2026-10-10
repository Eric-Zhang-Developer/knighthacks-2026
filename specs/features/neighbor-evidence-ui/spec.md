---
name: Evidence cards: what an idea shares with and how it differs from each neighbor
depends_on: [neighbor-evidence-api, idea-create-ui]
owns: [components/evidence/, tests/neighbor-evidence-ui/, tests/e2e/neighbor-evidence-ui/]
assignee: ""
---

# Neighbor evidence cards (F05): UI

Frontend half: Mac workers only (user decision 2026-10-10). Build against the response shape pinned in `neighbor-evidence-api`; the routes exist once it is done.

## Plan
1. Cards in the right column for `activeIdeaVersionId`; each shows its labels, and links to the neighbor's drawer (sets `selectedProjectId`) and source.

## Requirements
- Every claim shows its label; colour is never the only signal.
- Loading and failure states are visible.

## Validation
1. Save an idea -> cards for each neighbor, with labels and source links that open the right project.
2. `tests/e2e/neighbor-evidence-ui/` covers 1; keep a screenshot.

## Defaults
Cards collapse to overlaps and differences; uncertainty on expand.
