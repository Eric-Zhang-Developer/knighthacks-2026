## What shipped
One workspace-scoped read restores saved ideas, latest challenge sessions/rounds, snapshots and token-free share metadata; listed shares can be revoked idempotently, with ambiguous IDs rejected.
## Where it lives
`lib/workspace/state.ts`, `app/api/workspace/state/`, `app/api/workspace/shares/`, `tests/workspace-restore-api/`, `tests/e2e/workspace-restore-api/`.
## How to check it
verify: `node scripts/verify.mjs workspace-restore-api "C:\Users\kirol\OneDrive\Desktop\Knighthack\.git\agent-evidence\workspace-restore-api\20261010T191427Z"` pass at bad51d4
## Gaps
Real TEST-Neon/HTTP/browser verification used explicitly fictional stored fixtures and cleaned up its workspaces; no provider, production or user trial claimed. Frontend restoration is the separate workspace-restore-ui feature. The existing public share API returns410 and its client page renders revoked; the spec now names both accurately.
