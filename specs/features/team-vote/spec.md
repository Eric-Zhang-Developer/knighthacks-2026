---
name: Private teammate votes, revealed only when both have voted
depends_on: [guest-workspace, idea-revisions]
owns: [app/api/votes/, lib/votes/, components/votes/, db/schema/votes.ts, tests/team-vote/, tests/e2e/team-vote/]
assignee: ""
---

# Team convergence (F29)

## Plan
1. Each member picks a preferred version and writes one concern.
2. `GET /api/votes` returns only your own vote until both have voted; then both, with agreement shown.

## Requirements
- The server enforces it: no route returns the other vote early (test it with raw requests).
- Changing your vote after reveal is allowed and shows as changed.

## Validation
1. Browser A votes; A's raw `GET /api/votes` has no B vote and B's has no A vote; B votes -> both see both.
2. `tests/e2e/team-vote/` runs two browsers plus the raw requests.

## Defaults
Reveal needs both votes; no early reveal.
