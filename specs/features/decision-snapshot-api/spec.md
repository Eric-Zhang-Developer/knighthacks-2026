---
name: Freeze a chosen version into an immutable snapshot
depends_on: [neighbor-evidence-api, idea-revisions-api, challenge-api]
owns: [app/api/snapshots/, lib/snapshots/, db/schema/snapshots.ts, tests/decision-snapshot-api/, tests/e2e/decision-snapshot-api/]
assignee: ""
---

# Decision snapshot (F32): API

Backend half (user decision 2026-10-10: backend is Windows). Windows workers first; a Mac worker may take it if it stays unclaimed for 15 minutes, so the backend chain never waits on one machine.

## Plan
1. `POST /api/snapshots` `{"versionId"}` -> stores a frozen JSON copy: idea, audience, nearest alternatives, what differs, the main uncertainty, and the next test; returns `{"snapshotId", "data"}`.
2. `GET /api/snapshots/:id` -> the stored JSON only.

## Requirements
- Before freezing a choice, ensure the chosen version's default top-three evidence batch exists through `lib/evidence/`. Reuse saved cards; generate only missing cards. If generation fails, return the safe retryable error without saving a snapshot. A version with no neighbors still has empty evidence.
- Later edits to the workspace don't change a saved snapshot.
- Excludes votes, transcripts and private notes.
- The next test is an explicit proposed-test claim saved by a challenge for this exact version, or null when none exists. Select the newest session containing one, then its highest qualifying round (sessions have timestamps; individual rounds do not). Reading that stored claim requires `challenge-api`; no challenge answer or question is copied.

## Validation
1. Create a snapshot; accept a new revision; `GET` it -> byte-identical JSON.
2. `tests/e2e/decision-snapshot-api/` covers 1.
3. Choose a branch before opening its evidence panel: its snapshot contains the generated evidence, and a repeated choice reuses it. Evidence failure saves no snapshot; retry succeeds once evidence is available.

## Defaults
One snapshot per choice; choosing again makes a new one.
