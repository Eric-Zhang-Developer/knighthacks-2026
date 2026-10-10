## What shipped
A reload returns to the idea version you chose, including a branch or older revision. Decide lists past snapshots, newest first (10, then "Show all"); choosing one shows it. Under each snapshot, its share links show date and live/revoked, with a dialog-free Revoke. The choice is remembered per workspace in `localStorage`, every access guarded: with storage blocked the page starts on the newest idea, as before.
## Where it lives
`lib/store.ts` (rememberActive/rememberedActive), `components/snapshot/` (restore.ts, History.tsx, index.tsx, CSS), `tests/workspace-restore-ui/`, `tests/e2e/workspace-restore-ui/`
## How to check it
verify: `node scripts/verify.mjs workspace-restore-ui /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/workspace-restore-ui/20261010T193625Z` pass at f5739b0 (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/workspace-restore-ui/20261010T193625Z)
Run with `DATABASE_URL` = `TEST_DATABASE_URL`, `AI_STUB_DIR` a fresh absolute temp folder, `AI_STUB_ALLOW=1`.
## Gaps
- Model output is stubbed; no live run. Challenge-session resume is out of scope (spec); a follow-up is still to file.
- `tests/e2e/decision-snapshot-ui` and `share-qr-ui` fail on origin/main too (no evidence fixtures since #181): #263.
