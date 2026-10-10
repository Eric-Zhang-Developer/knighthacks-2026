---
name: Freeze the chosen idea into a decision snapshot
depends_on: [neighbor-evidence, idea-revisions]
owns: [app/api/snapshots/, lib/snapshots/, components/snapshot/, db/schema/snapshots.ts, tests/decision-snapshot/, tests/e2e/decision-snapshot/]
assignee: ""
---

# Decision snapshot (F32)

## Plan
1. "Choose this version" -> store a frozen JSON copy: idea, audience, nearest alternatives, what differs, the
   main uncertainty, and the next test.
2. A snapshot view renders from that JSON only.

## Requirements
- Later edits to the workspace don't change a saved snapshot.
- Excludes votes, transcripts and private notes.

## Validation
1. Choose a version -> snapshot view; accept a new revision -> the snapshot is unchanged.
2. `tests/e2e/decision-snapshot/` covers 1.

## Defaults
One snapshot per choice; choosing again makes a new one.
