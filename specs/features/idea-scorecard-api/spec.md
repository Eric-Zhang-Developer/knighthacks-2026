---
name: Score an idea version on the event's five criteria, with a reason for each
depends_on: [idea-create-api, neighbor-evidence-api, ai-client]
owns: [app/api/scorecard/, lib/scorecard/, db/schema/scorecard.ts, tests/idea-scorecard-api/, tests/e2e/idea-scorecard-api/]
assignee: ""
---

# Idea scorecard: API (#269)

Backend half: Windows workers first. A Mac worker may take it after 15 minutes unclaimed. User request: open an idea
and see why it's good, why it's bad, and a score.

## Plan
1. `POST /api/scorecard/:versionId` generates and stores a scorecard. `GET` returns the latest.
2. Criteria come from `specs/context/event.md`: originality, technical understanding, functionality, design and wow
   factor. Each gets `{"score": 1-5, "for": [..], "against": [..], "label"}`, and points cite evidence card
   `sourceIds` where they rely on them.
3. Originality's reasons must use the idea's real neighbours. Empty map space is never a reason.

## Requirements
- No total and no win probability. Each criterion stands alone, labelled `inferred` unless every point cites a
  source.
- Insert-only.

## Validation
1. Save an idea, then POST → five criteria, each with a score from 1 to 5 and at least one point for and one
   against. GET returns it.
2. `tests/e2e/idea-scorecard-api/` covers 1 with Gemini stubbed, plus one live run noted in the done note.

## Defaults
When evidence is thin, the score is null with "evidence is insufficient", not a guess.
Response and `GET`: `{"id", "versionId", "criteria": [{"criterion", "score": 1-5 | null, "for": [Claim],
"against": [Claim], "label": "supported" | "inferred", "note": string | null}], "sources": [{"projectId", "title",
"url"}], "createdAt"}`, criteria in rubric order. Sources are the version's top-three evidence cards; grounding rules
are in `specs/decisions/idea-scorecard-api-schema.md`.
