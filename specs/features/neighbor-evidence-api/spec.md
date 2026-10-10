---
name: Generate and store labelled evidence cards per idea version
depends_on: [idea-create-api]
owns: [app/api/evidence/, lib/evidence/, db/schema/evidence.ts, tests/neighbor-evidence-api/, tests/e2e/neighbor-evidence-api/]
assignee: ""
---

# Neighbor evidence cards (F05): API

Backend half (user decision 2026-10-10: backend is Windows). Windows workers first; a Mac worker may take it if it stays unclaimed for 15 minutes, so the backend chain never waits on one machine.

## Plan
1. `POST /api/evidence/:versionId`: for each neighbor, Gemini compares the idea with the neighbor's record: overlaps, differences, and one uncertainty.
2. Store each card with the neighbor's project ID and the excerpt it relied on.
3. Response and `GET /api/evidence/:versionId`: `{"cards": [{"projectId", "url", "title", "excerpt", "overlaps": [Claim], "differences": [Claim], "uncertainty": Claim}]}` (`Claim` from `lib/ai/claims.ts`).

## Requirements
- Gemini calls go through `lib/ai/` (`generate`); labelled claims go through `checkClaims`.
- Each statement is labelled `supported` (quotes the stored excerpt), `inferred` or `unverified`.
- A card never cites anything but the neighbor record it was given.
- Cards are stored per version; a second `POST` returns the stored cards without regenerating.

## Validation
1. `POST` for a saved version -> cards for its top neighbors; every `supported` claim's source is that card's project.
2. `POST` again -> the same rows, no Gemini call.
3. `tests/e2e/neighbor-evidence-api/` covers 1–2 (Gemini stubbed in the test only). Keep the stored rows.

## Defaults
Generate cards for the top 3 neighbors first; the rest on request.
