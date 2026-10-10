---
name: Compare a saved idea version with its strongest existing alternative on the user's task
depends_on: [neighbor-evidence-api, ai-client]
owns: [app/api/alternative/, lib/alternative/, db/schema/alternative.ts, tests/strongest-alternative-api/, tests/e2e/strongest-alternative-api/]
assignee: ""
---

# Strongest existing alternative (F26): API

Backend half (user decision 2026-10-10: backend is Windows). Windows workers first; a Mac worker may take it if it
stays unclaimed for 15 minutes. The only alternatives we hold are corpus projects; products and workarounds
outside the corpus would need F13 research, which isn't planned.

## Plan
1. `POST /api/alternative/:versionId`: the version's highest-cosine neighbor is the candidate. Through `lib/ai/`,
   compare it with the idea on the idea's own `workflow` and `problem` fields: does the alternative already let that
   user do that task, step by step?
2. Store one result per version; a second `POST` returns the stored one. `GET /api/alternative/:versionId` reads it.
3. Response: `{"versionId", "projectId", "url", "title", "points": [{"step", "claim": Claim}], "missingWorkflow":
   boolean}` (`Claim` from `lib/ai/claims.ts`).

## Requirements
- Each point names a workflow step from the idea; feature-name lists don't count.
- Every claim goes through `checkClaims` against that one neighbor record.
- An idea with no `workflow` returns `missingWorkflow: true` and no points, without calling the model.
- Same session, same-origin and 404 rules as the other idea routes. Apply the table with additive SQL on the test
  branch; never `drizzle-kit push` from a feature branch (#125).

## Validation
1. `POST` for a saved version -> its top neighbor and 2–4 points, each with a step and a labelled claim citing only
   that project; `POST` again -> the same row, no model call.
2. A version with no workflow -> `missingWorkflow: true`, no model call.
3. `tests/e2e/strongest-alternative-api/` covers 1–2 with fixtures (`AI_STUB_ALLOW=1`). Keep the stored row.

## Defaults
One alternative per version; regenerate only on a new version.
