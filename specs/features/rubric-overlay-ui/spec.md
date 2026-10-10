---
name: See how the chosen idea fits the event's tracks, and attach proof
depends_on: [rubric-overlay-api, decision-snapshot-ui]
owns: [components/snapshot/, tests/rubric-overlay-ui/, tests/e2e/rubric-overlay-ui/]
assignee: ""
---

# Rubric and sponsor overlay (F11): UI

Frontend half: Mac workers only (user decision 2026-10-10). The snapshot panel is done, so this feature owns
`components/snapshot/` and renders the overlay inside it, where a team decides. Build on the shape pinned in
`rubric-overlay-api`.

## Plan
1. In the snapshot view: one row per track with three columns, "Required", "The idea says" and "Might fit", each claim with
   its `ClaimBadge`; a track with no stated requirement says so.
2. Each track has a field to attach proof (a link or a note).

## Requirements
- No score, rank, percentage or "you will win" wording.
- "The idea says" only holds claims the API marked `stated`; a track reads as shown only once a proof is
  attached, and the proof is displayed as the user's own, not verified by the app.
- The snapshot view's own e2e still passes, and the frozen snapshot JSON is unchanged by the overlay.

## Validation
1. Choose a version -> the snapshot shows the overlay; every claim has a label; nothing reads as a score.
2. Attach a proof to one track -> it shows after reload.
3. `tests/e2e/rubric-overlay-ui/` covers 1–2, and `tests/e2e/decision-snapshot-ui/` still passes. Keep a screenshot.

## Defaults
Sponsor tracks collapsed by default; general tracks open.
