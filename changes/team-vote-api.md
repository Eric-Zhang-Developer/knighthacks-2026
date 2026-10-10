## What shipped
`PUT /api/votes` `{versionId, concern}` sets your vote (a version in your workspace; concern is text or null). `GET /api/votes` returns `{mine, theirs: null, revealed: false}` until both teammates have voted, then `{mine, theirs, revealed: true, agreement}`; each vote carries `changedAfterReveal`, set when its version changes after the reveal.
## Where it lives
`app/api/votes/`, `lib/votes/service.ts`, `db/schema/votes.ts`, `tests/team-vote-api/`, `tests/e2e/team-vote-api/`.
## How to check it
verify: `node scripts/verify.mjs team-vote-api .git/agent-evidence/team-vote-api/20261010T142514Z` pass at 0182166 (Mac; Neon test branch; owner + invited teammate sessions; B's raw response before reveal contains nothing of A's vote).
## Gaps
`votes` was created on the test branch with additive SQL: `drizzle-kit push` from this branch would drop in-flight `snapshots` (#130). Production schema is pending (#113). Editing only a concern doesn't count as a changed vote (decision in the commit message).
