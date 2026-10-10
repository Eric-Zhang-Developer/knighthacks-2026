---
name: Suggested revisions you can accept or reject, and the revision trail
depends_on: [idea-revisions-api, idea-create-ui]
owns: [components/revisions/, tests/idea-revisions-ui/, tests/e2e/idea-revisions-ui/]
assignee: ""
---

# Guided refinement (F06) + revision trail (F07): UI

Frontend half: Mac workers only (user decision 2026-10-10). Build against the response shape pinned in `idea-revisions-api`; the routes exist once it is done.

## Plan
1. Suggestions panel with accept and reject per suggestion.
2. Trail UI: the version chain; selecting a past version shows it without changing the current one.

## Requirements
- Accept updates `ideaStars` and `activeIdeaVersionId`; reject changes nothing on screen but the suggestion.

## Validation
1. Propose -> suggestions; reject one -> no new star; accept one -> a new star and a trail of 2.
2. Click version 1 in the trail -> it shows; the current version is unchanged.
3. `tests/e2e/idea-revisions-ui/` covers 1–2; keep a screenshot.

## Defaults
Animate the star moving between versions unless reduced motion is on.
