## What shipped
The root layout mounts `components/workspace/`, which starts a guest workspace (`POST /api/workspace`, once per page load) only on exactly `/`, and shows its ID, a "no accounts" warning and an Invite a teammate button whose link opens in a dropdown. `/invite/:token` shows a Join button; only that button redeems. A used or expired link shows "This invite is unavailable". Invite and share pages never create a session.
## Where it lives
`app/layout.tsx`, `components/workspace/` (`index.tsx`, `Join.tsx`, `api.ts`, `copy.ts`), `app/invite/[token]/page.tsx`, `tests/guest-workspace-ui/`, `tests/e2e/guest-workspace-ui/`
## How to check it
verify: `node scripts/verify.mjs guest-workspace-ui /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/guest-workspace-ui/20261010T131804Z` pass at 2f3245b (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/guest-workspace-ui/20261010T131804Z)
Run with `DATABASE_URL` set to `TEST_DATABASE_URL` (the suite refuses otherwise) and `TEST_DATABASE_URL` exported. This also exercises guest-workspace API Validation 1 (cookie attributes, same workspace with different members) and the reuse/expiry 410s against real Neon.
## Gaps
- The main `DATABASE_URL` database has no `workspaces`/`members`/`invites` tables (only the test branch does), so the app outside tests answers 503 and shows "Couldn't start your workspace" until the schema is pushed there.
- One of four verify runs failed with 503s from `POST /api/workspace` on the test branch; the database answered normally right after and the rerun passed. Cause unknown.
- The expired-invite check expires a UI-created invite directly in the test database, rather than waiting 24 hours.
