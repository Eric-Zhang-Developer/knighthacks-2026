---
name: List the assumptions an idea rests on and what evidence would reverse each
depends_on: [neighbor-evidence-api, challenge-api, ai-client]
owns: [app/api/assumptions/, lib/assumptions/, db/schema/assumptions.ts, tests/change-mind-api/, tests/e2e/change-mind-api/]
assignee: ""
---

# What would change your mind? (F23): API

Backend half (user decision 2026-10-10: backend is Windows). Windows workers first; a Mac worker may take it if it stays unclaimed for 15 minutes.

## Plan
1. `POST /api/assumptions/:versionId`: through `lib/ai/`, from the version's fields, its evidence cards and any challenge rounds on it, list the assumptions the idea rests on, each with the evidence that would reverse it.
2. Response and `GET`: `{"versionId", "assumptions": [{"kind": "need" | "data" | "feasibility" | "differentiation", "assumption": Claim, "reversal": string | null, "insufficient": boolean}]}`.

## Requirements
- Model calls go through `lib/ai/` (`generate`); labelled claims go through `checkClaims`.
- Same workspace session, same-origin and 404 rules as the other idea routes.
- Stored per version; a second `POST` returns the stored result without a model call. Apply the table with additive SQL on the test branch; never `drizzle-kit push` from a feature branch (#125).
- Every assumption has a falsifiable `reversal` condition, or `insufficient: true` with `reversal: null` (V3 F23 acceptance); never both, never neither.
- An assumption grounded in an evidence card cites that card's project; otherwise it is `inferred` or `unverified`.

## Validation
1. `POST` for a saved version -> assumptions of at least two kinds; each has a reversal or is marked insufficient, never both. `POST` again -> the same row, no model call.
2. A fixture item with neither a reversal nor `insufficient` -> rejected and regenerated once by `generate`, then dropped.
3. `tests/e2e/change-mind-api/` covers 1–2 with fixtures (`AI_STUB_ALLOW=1`). Keep the stored row.

## Defaults
At most 6 assumptions, at most 2 per kind.
