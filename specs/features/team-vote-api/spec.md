---
name: Store private votes and reveal them only when both teammates have voted
depends_on: [guest-workspace, idea-revisions-api]
owns: [app/api/votes/, lib/votes/, db/schema/votes.ts, tests/team-vote-api/, tests/e2e/team-vote-api/]
assignee: ""
---

# Team convergence (F29): API

Backend half (user decision 2026-10-10: backend is Windows). Windows workers first; a Mac worker may take it if it stays unclaimed for 15 minutes, so the backend chain never waits on one machine.

## Plan
1. `PUT /api/votes` `{"versionId", "concern"}` sets your vote.
2. `GET /api/votes` -> `{"mine", "theirs": null, "revealed": false}` until both have voted; then both, with `agreement` and `changedAfterReveal` flags.

## Requirements
- The server enforces it: no route returns the other vote early.
- Changing your vote after reveal is allowed and shows as changed.

## Validation
1. A votes; A's raw `GET /api/votes` has no B vote and B's has no A vote; B votes -> both see both.
2. `tests/e2e/team-vote-api/` runs the raw requests with two sessions.

## Defaults
Reveal needs both votes; no early reveal.
