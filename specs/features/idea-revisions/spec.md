---
name: Suggested revisions you can accept or reject, and the revision trail
depends_on: [idea-create]
owns: [app/api/revisions/, lib/revisions/, components/revisions/, db/schema/revisions.ts, tests/idea-revisions/, tests/e2e/idea-revisions/]
assignee: ""
---

# Guided refinement (F06) + revision trail (F07)

## Plan
1. `POST /api/revisions/propose`: Gemini suggests up to 3 specific changes (audience, workflow, constraint or
   interaction), each with a reason. It takes optional context (a challenge outcome).
2. Accept -> insert a new `idea_versions` row whose parent is the current version, re-embedded and re-placed.
   Reject -> no write.
3. Trail UI: the version chain; selecting a past version shows it without changing the current one.

## Requirements
- Accepting is the only way a version is created here; reject changes nothing in the database.
- Concurrent accepts on the same parent both survive, as sibling versions.

## Validation
1. Propose -> suggestions; reject one -> no new row; accept one -> a new star and a trail of 2.
2. Click version 1 in the trail -> it shows; the current version is unchanged.
3. `tests/e2e/idea-revisions/` covers 1–2; keep the rows.

## Defaults
Animate the star moving between versions unless reduced motion is on.
