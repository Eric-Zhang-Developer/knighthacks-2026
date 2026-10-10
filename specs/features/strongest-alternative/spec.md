---
name: Compare the idea with its strongest existing alternative on the user's actual task
depends_on: [neighbor-evidence-ui, ai-client]
owns: [app/api/alternative/, lib/alternative/, components/alternative/, db/schema/alternative.ts, tests/strongest-alternative/, tests/e2e/strongest-alternative/]
assignee: ""
---

# Strongest existing alternative (F26)

Backlog. The only alternatives we hold are corpus projects; products and workarounds outside the corpus would need
F13 research, which isn't planned.

## Plan
1. Mount: a separate `fix: mount the alternative panel in the shell` PR adds `<Alternative />` to the right column of
   `app/page.tsx`.
2. `POST /api/alternative/:versionId`: the version's highest-cosine neighbor is the candidate. Through `lib/ai/`,
   compare it with the idea on the idea's own `workflow` and `problem` fields: does the alternative already let
   that user do that task, step by step?
3. Store the result per version; the panel shows it with the neighbor's source link.

## Requirements
- The comparison is about the user's task, not feature names: each point names a workflow step.
- Every point is a `Claim` checked with `checkClaims` against that one neighbor record.
- If the idea has no `workflow`, say so and ask for it instead of comparing.

## Validation
1. Open a saved idea -> the panel names its top neighbor and 2–4 points, each labelled and tied to a workflow step.
2. `tests/e2e/strongest-alternative/` covers 1 with Gemini stubbed in the test only. Keep the stored row.

## Defaults
One alternative per version; regenerate only on a new version.
