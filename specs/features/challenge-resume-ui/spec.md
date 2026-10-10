---
name: Resume the latest challenge session after a reload
depends_on: [workspace-restore-ui, constellation-ui]
owns: [components/challenge/, tests/challenge-resume-ui/, tests/e2e/challenge-resume-ui/]
assignee: ""
---

# Challenge resume

Frontend only: Mac workers (user decision 2026-10-10). Follow-up named in workspace-restore-ui's spec and filed as
#264: a reload starts the challenge over, though `GET /api/workspace/state` already returns each version's latest
session (`sessionId`, `perspective`, `state`, `rounds`). No API half: the route exists and makes no model call. The
challenge panel is done (challenge-ui, prove-it-ui, change-mind-ui, constellation-ui), so this feature owns
`components/challenge/` and renders inside it.

## Plan
1. When the panel mounts or `activeIdeaVersionId` changes, read that version's latest session from
   `GET /api/workspace/state` and show its stored rounds as the panel already renders them, with their prove-it
   experiments attached. A stored round with `source: null` (one that never finished) renders as "This round didn't
   finish" with no source line: the current renderer reads `source.label`, so it must not reach it.
2. Continue from the stored `state`: `awaiting` shows the answer box for the latest round; `idle` with fewer than 3
   rounds offers the next round; 3 rounds reads as finished; `generating` or `answering` shows `PanelState` loading
   with "Still working" and a "Check again" button that re-reads the state once per click. Reading never clears a
   stuck operation, so "Check again" also offers "Retry this round", which calls the existing round route: the
   server allows it only once the operation's 5-minute lease has expired, and a refusal reads "Still working; try
   again shortly".
3. "Start over" begins a new session only when the person asks; nothing is discarded or regenerated on load.

## Requirements
- Loading a session makes no model call and starts no session (the state route is read-only).
- A version with no session shows the panel exactly as now.
- The challenge, prove-it, change-mind and constellation e2e suites still pass unchanged.

## Validation
1. Start a challenge with fixtures (`AI_STUB_ALLOW=1`), answer round 1, reload -> round 1 and its answer show, and
   the next round is offered; no request to a challenge write route was made by the reload.
2. Reload while round 2 is `awaiting` -> the answer box for round 2 shows, and answering it continues the same
   `sessionId`.
3. Switch to a version with no session -> the panel shows its start state.
4. A stored round with `source: null` -> the panel shows "This round didn't finish" and doesn't crash. A session
   stuck in `generating` with its lease expired -> "Retry this round" succeeds; with the lease live -> the refusal
   message, and the session is unchanged.
5. `tests/e2e/challenge-resume-ui/` covers 1–4, and `tests/e2e/challenge-ui/`, `tests/e2e/prove-it-ui/`,
   `tests/e2e/change-mind-ui/` and `tests/e2e/constellation-ui/` still pass. Keep a screenshot.

## Defaults
"Check again" never polls on its own.
