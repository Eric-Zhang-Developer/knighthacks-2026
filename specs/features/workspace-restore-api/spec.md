---
name: One read of everything a workspace has saved, so a reload loses nothing
depends_on: [guest-workspace, idea-create-api, challenge-api, decision-snapshot-api, share-qr-api]
owns: [app/api/workspace/state/, app/api/workspace/shares/, lib/workspace/state.ts, tests/workspace-restore-api/, tests/e2e/workspace-restore-api/]
assignee: ""
---

# Workspace restore: API

Backend: Windows workers first. Several panels keep their state only in the page (Gaps of challenge-ui,
decision-snapshot-ui, share-qr-ui, rubric-overlay-ui): a reload during the demo shows an empty panel although the
rows exist. Share links can't be revoked after the page that made them is gone.

## Plan
1. `GET /api/workspace/state` -> `{"ideas": <as GET /api/ideas>, "challenges": [{"versionId", "sessionId",
   "perspective", "state", "rounds": [...]}] (latest session per version), "snapshots": [{"id", "versionId",
   "createdAt"}], "shares": [{"id", "snapshotId", "createdAt", "revokedAt"}]}`.
2. `POST /api/workspace/shares/:id/revoke` revokes a link by its listed `id`.

## Requirements
- Same workspace session, same-origin and 404 rules as the other routes; another workspace's rows never appear.
- A share's `id` is the first 16 hex characters of its stored `token_hash`. The token itself is never returned
  (it isn't stored), so the list can't be used to open a link.
- `rounds` are the stored rows as the challenge API returns them; nothing is regenerated and no model is called.
- Revoking twice returns the same `revokedAt`; `GET /api/shares/:token` then answers 410 and the existing
  `/s/:token` page shows its revoked-link state. The public page is a client-rendered shell, not an HTTP 410 route.
- One request; no N+1 queries per idea (one query per table).

## Validation
1. A workspace with two ideas, one challenge session, one snapshot and one share -> one `GET` returns all of them.
2. A second workspace's session -> none of the first workspace's rows.
3. Revoke by `id` -> `GET /api/shares/:token` answers 410, `/s/:token` shows the revoked-link state, and the list
   shows `revokedAt`. Repeating revocation preserves that timestamp.
4. `tests/e2e/workspace-restore-api/` covers 1–3 against the test branch (`AI_STUB_ALLOW=1`). Keep the response.

## Defaults
Each list capped at 50 newest rows.
