---
name: Choose a version and view its decision snapshot
depends_on: [decision-snapshot-api, idea-revisions-ui]
owns: [components/snapshot/, tests/decision-snapshot-ui/, tests/e2e/decision-snapshot-ui/]
assignee: ""
---

# Decision snapshot (F32): UI

Frontend half: Mac workers only (user decision 2026-10-10). Build against the response shape pinned in `decision-snapshot-api`; the routes exist once it is done.

## Plan
1. "Choose this version" -> snapshot view rendered from the snapshot JSON only.

## Requirements
- The view reads nothing but the snapshot JSON.

## Validation
1. Choose a version -> snapshot view; accept a new revision -> the snapshot view is unchanged.
2. `tests/e2e/decision-snapshot-ui/` covers 1.

## Defaults
The view is printable.
