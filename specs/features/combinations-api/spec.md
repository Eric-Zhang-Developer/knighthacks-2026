---
name: Suggest a joined workflow inspired by two of an idea's real neighbors
depends_on: [neighbor-evidence-api, ai-client]
owns: [app/api/combinations/, lib/combinations/, db/schema/combinations.ts, tests/combinations-api/, tests/e2e/combinations-api/]
assignee: ""
---

# Meaningful combinations (F28): API

Backend half (user decision 2026-10-10: backend is Windows). Windows workers first; a Mac worker may take it if it stays unclaimed for 15 minutes.

## Plan
1. `POST /api/combinations/:versionId`: from the version's saved neighbors, through `lib/ai/`, suggest up to 3 combinations, each joining two neighbor projects into one workflow.
2. Response and `GET`: `{"versionId", "suggestions": [{"user", "benefit": Claim, "workflow": [string], "workflowIsProposal": true, "sources": [{"projectId", "url", "title"}, {...}], "claims": [Claim]}]}`.

## Requirements
- Model calls go through `lib/ai/` (`generate`); labelled claims go through `checkClaims`.
- Same workspace session, same-origin and 404 rules as the other idea routes.
- Stored per version; a second `POST` returns the stored result without a model call. Apply the table with additive SQL on the test branch; never `drizzle-kit push` from a feature branch (#125).
- Every suggestion names a user, a benefit, a workflow and exactly two source projects from the version's own neighbors (V3 F28 acceptance); a suggestion missing any is dropped, not padded.
- `benefit` and each claim cite only those two projects; anything else is `inferred` or `unverified`. The workflow steps are a proposal, not claims, and the response marks them so.
- A suggestion never claims the combination already exists or will win.

## Validation
1. `POST` for a saved version -> 1–3 suggestions, each with user, benefit, workflow and two source projects that are among the version's neighbors; every claim cites only them. `POST` again -> the same row, no model call.
2. A fixture that returns a third source or an outside project ID -> that suggestion is dropped.
3. `tests/e2e/combinations-api/` covers 1–2 with fixtures (`AI_STUB_ALLOW=1`). Keep the stored row.

## Defaults
Pairs are drawn from the top 5 neighbors.
