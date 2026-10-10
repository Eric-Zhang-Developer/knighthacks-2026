---
name: Turn the chosen idea version into a build plan for the hours left
depends_on: [idea-create-api, neighbor-evidence-api, ai-client]
owns: [app/api/plan/, lib/plan/, db/schema/plan.ts, tests/build-plan-api/, tests/e2e/build-plan-api/]
assignee: ""
---

# Build plan: API (#269)

Backend half: Windows workers first. A Mac worker may take it after 15 minutes unclaimed. User request: once the user
picks an idea, a Plan section helps them plan the build.

## Plan
1. `POST /api/plan/:versionId` `{"hoursLeft", "teamSize", "skills"?}` generates and stores a plan.
   `GET /api/plan/:versionId` returns the latest one.
2. The plan is `{"tour": [step], "cut": [item], "timeline": [{"hour", "goal"}], "risks": [{"risk", "countermeasure"}]}`.
   Every item carries `label` (`supported` with `sourceIds`, `inferred`, or `unverified`).
3. Context: the version's fields and its evidence cards. Nothing else is invented.

## Requirements
- Plans are insert-only. Generating again creates a new row.
- The timeline fits `hoursLeft`, and its last entry is a code freeze at least one hour before the end.
- No win probability or prize odds.

## Validation
1. Save an idea, POST a plan with `hoursLeft: 10` → a stored plan whose timeline ends by hour 9. GET returns it.
2. `tests/e2e/build-plan-api/` covers 1 with Gemini stubbed, plus one live run noted in the done note.

## Defaults
`teamSize` 2. Tour at most 6 steps, cut list at most 8 items.
