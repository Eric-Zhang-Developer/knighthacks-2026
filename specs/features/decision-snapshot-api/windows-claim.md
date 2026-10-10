# Windows backend claim

Worker: kiro-agent-1. Git author: Kiro. Model: GPT-6 Astra.
Issue #77; current origin/main specifications and milestone order are authoritative.

Scope: immutable authorized snapshots of a chosen version, real alternatives and stored labelled evidence; explicit unknowns, no private votes/transcripts/notes.
Builder owns app/api/snapshots/, lib/snapshots/, db/schema/snapshots.ts, tests/decision-snapshot-api/, and feature decision notes.
Independent GPT-6 Astra reviewer is read-only. Root owns E2E, dependency/spec integration, Git/GitHub and database verification.
Claude owns all frontend tasks. No new dependencies or frameworks.
