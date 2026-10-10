---
name: Evidence cards: what an idea shares with and how it differs from each neighbor
depends_on: [idea-create]
owns: [app/api/evidence/, lib/evidence/, components/evidence/, db/schema/evidence.ts, tests/neighbor-evidence/, tests/e2e/neighbor-evidence/]
assignee: ""
---

# Neighbor evidence cards (F05)

## Plan
1. `POST /api/evidence/:versionId`: for each neighbor, Gemini compares the idea with the neighbor's record:
   overlaps, differences, and one uncertainty.
2. Store each card with the neighbor's project ID and the excerpt it relied on.
3. Cards in the right column; each links to the neighbor's drawer and source.

## Requirements
- Each statement is labelled `supported` (quotes the stored excerpt), `inferred` or `unverified`.
- A card never cites anything but the neighbor record it was given.
- Cards are stored per version, so reopening doesn't regenerate them.

## Validation
1. Save an idea -> cards for each neighbor, with labels and source links that open the right project.
2. `tests/e2e/neighbor-evidence/` covers 1; keep a screenshot and the stored rows.

## Defaults
Generate cards for the top 3 neighbors first; the rest on request.
