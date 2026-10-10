---
name: A reload brings back the chosen idea, past snapshots and their share links, revocable
depends_on: [workspace-restore-api, decision-snapshot-ui, share-qr-ui]
owns: [lib/store.ts, components/snapshot/, tests/workspace-restore-ui/, tests/e2e/workspace-restore-ui/]
assignee: ""
---

# Workspace restore: UI

Frontend: Mac workers. Uses `GET /api/workspace/state`.

## Plan
1. `lib/store.ts` remembers `activeIdeaVersionId` per workspace in `localStorage` and restores it on load when that
   version is still in the workspace's ideas.
2. The Decide panel (`components/snapshot/`) lists past snapshots, newest first; choosing one shows it.
3. Each listed snapshot shows its share links (date, live or revoked) and a Revoke button per live link. They live
   in the Decide panel because a link belongs to a snapshot; the Share panel (`components/share/`) is unchanged.

## Requirements
- Every `localStorage` read and write is in try/catch; with storage blocked the page works and starts on the newest
  idea, as now.
- A remembered version that no longer exists is dropped silently.
- Revoke asks for no browser dialog: the button becomes "Revoked" and the row shows the time.
- Challenge-session resume is out of scope here: `constellation-ui` owns `components/challenge/` now. File it as a
  follow-up once that merges.

## Validation
1. Choose version 2 of an idea, reload -> version 2 is still active.
2. Make two snapshots, reload -> both are listed; choose the older -> it shows.
3. Make a share link, reload -> it's listed; Revoke -> the link's page shows the revoked state.
4. Storage blocked (Playwright context with it denied) -> the page loads and shows the newest idea.

## Defaults
Lists show at most 10 rows with "Show all" for the rest.
