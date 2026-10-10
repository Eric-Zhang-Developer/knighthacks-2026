---
name: Turn a saved idea version into a three-step judge interaction
depends_on: [idea-create-api, ai-client]
owns: [app/api/moment/, lib/moment/, db/schema/moment.ts, tests/moment-api/, tests/e2e/moment-api/]
assignee: ""
---

# Show me the moment (F30): API

Backend half (user decision 2026-10-10: backend is Windows). Windows workers first; a Mac worker may take it if it stays unclaimed for 15 minutes.

## Plan
1. `POST /api/moment/:versionId`: through `lib/ai/`, from the version's fields, draft exactly three steps of a judge interaction.
2. Response and `GET`: `{"versionId", "steps": [{"judgeDoes", "appears", "demonstrates": Claim}] (exactly 3), "basis": [Claim]}`.

## Requirements
- Model calls go through `lib/ai/` (`generate`); labelled claims go through `checkClaims`.
- Same workspace session, same-origin and 404 rules as the other idea routes.
- Stored per version; a second `POST` returns the stored result without a model call. Apply the table with additive SQL on the test branch; never `drizzle-kit push` from a feature branch (#125).
- Each step names what the judge does, what appears and what that demonstrates (V3 F30 acceptance); a step missing any part fails validation.
- `demonstrates` and `basis` are `supported` only when they quote the version's own fields verbatim (checked by `lib/moment/`, since `checkClaims` checks source IDs, not text); otherwise they are `inferred`.
- It describes the user's planned project as planned, never as already working.

## Validation
1. `POST` for a saved version -> exactly three complete steps; `POST` again -> the same row, no model call.
2. A fixture with two steps or a step missing `demonstrates` -> rejected and regenerated once, then a 502. A fixture whose `demonstrates` names a capability absent from the version yet is labelled `supported` -> downgraded to `inferred`.
3. `tests/e2e/moment-api/` covers 1–2 with fixtures (`AI_STUB_ALLOW=1`). Keep the stored row.

## Defaults
Each field at most 160 characters.
