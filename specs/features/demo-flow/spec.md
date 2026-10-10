---
name: One end-to-end run of the judge's demo path, locally and against production
depends_on: [voice, guest-workspace-ui, challenge-ui, branches-ui, team-vote-ui, share-qr-ui]
owns: [tests/demo-flow/, tests/e2e/demo-flow/]
assignee: ""
---

# Demo flow (roadmap demo, Functionality criterion)

Every feature tests itself; nothing tests the path a judge sees (`specs/roadmap.md`, "Where this is going").
Functionality is scored on "works end to end, reliably" (`specs/context/event.md`).

## Plan
1. `tests/e2e/demo-flow/`: one Playwright run of the demo path in two browser contexts: type an idea (the voice
   bar's text fallback) -> it becomes a star with neighbors -> evidence cards -> one challenge round -> accept a
   revision -> branch -> both teammates vote -> choose a version -> snapshot -> share link opened at phone width.
2. The same test runs against `next build && next start` locally and against the production URL when
   `DEMO_BASE_URL` is set.
3. Before judging: `python3 .agents/scripts/verify_release.py --commit $(git rev-parse origin/main)` and
   `demo_snapshot.py` for the fallback. Setting `[release].url` is a `contract:` PR (frozen config).

## Requirements
- Live model calls only when run against production; locally, model calls use the `lib/ai/` test stub.
- The test fails on a wrong result at any step (wrong star count, an unlabelled claim, an early vote reveal,
  a share page that sets a workspace cookie), not only on a crash.
- No invite link, share token or cookie value in saved evidence.

## Validation
1. `python3 .agents/scripts/verify.py --slug demo-flow --worktree .` -> pass; keep the screenshots per step.
2. With `DEMO_BASE_URL` set to production -> pass; record the time per step in the done note.
3. `verify_release.py` passes on the merged commit; the snapshot from `demo_snapshot.py` is kept.

## Defaults
Steps whose feature is on a milestone's `cut` list are skipped and listed in the done note.
