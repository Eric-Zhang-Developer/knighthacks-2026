---
name: Private teammate votes, revealed only when both have voted
depends_on: [team-vote-api, idea-revisions-ui]
owns: [components/votes/, tests/team-vote-ui/, tests/e2e/team-vote-ui/]
assignee: ""
---

# Team convergence (F29): UI

Frontend half: Mac workers only (user decision 2026-10-10). Build against the response shape pinned in `team-vote-api`; the routes exist once it is done.

## Plan
1. Each member picks a preferred version and writes one concern; the panel shows "waiting for your teammate" until reveal.

## Requirements
- The panel never shows the other vote before the API reveals it.

## Validation
1. Browser A votes -> waiting; browser B votes -> both see both and the agreement.
2. `tests/e2e/team-vote-ui/` runs two browsers.

## Defaults
Concern is one line, at most 200 characters.
