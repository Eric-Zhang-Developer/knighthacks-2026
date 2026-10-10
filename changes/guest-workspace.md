## What shipped
Guest workspace APIs with secure cookie sessions, single-use 24-hour invites, atomic two-member limits and workspace authorization.
## Where it lives
`app/api/workspace/`, `lib/workspace/`, `db/schema/workspace.ts`; unit and integration tests under `tests/guest-workspace/` and `tests/e2e/guest-workspace/`.
## How to check it
51 unit tests, typecheck and lint pass at b06b1ab. Live validation is **not verified**: `verify.py --slug guest-workspace --worktree .` failed at b06b1ab because Windows has no DATABASE_URL; evidence `.git/agent-evidence/guest-workspace/20261010T125052Z`.
## Gaps
The user explicitly requested merging the backend now on 2026-10-10 and assigned live verification to Claude on the Mac. API Validation 1–4 still require that dedicated-Neon run; PR #35 and issue #11 track the handoff. Browser acceptance belongs to the separate `guest-workspace-ui` feature and is not completed by this merge.
