---
name: Interpret, embed, place and save an idea as version 1
depends_on: [guest-workspace, search, ai-client]
owns: [app/api/ideas/, lib/ideas/, db/schema/ideas.ts, tests/idea-create-api/, tests/e2e/idea-create-api/]
assignee: ""
---

# Speak/type an idea (F03 text) + idea becomes a star (F04): API

Backend half (user decision 2026-10-10: backend is Windows). Windows workers first; a Mac worker may take it if it stays unclaimed for 15 minutes, so the backend chain never waits on one machine.

## Plan
1. Tables `ideas` and `idea_versions` (`parent_id`, `title`, `description`, `audience`, `problem`, `workflow`, `constraints`, `embedding`, `x/y/z`, `neighbor_ids`, `corpus_version`, `created_at`). Versions are insert-only.
2. `POST /api/ideas/interpret` `{"text"}` -> `{"title", "description", "audience", "problem", "workflow", "constraints"}` (any may be `null`), or 502 `{"error"}` when Gemini fails.
3. `POST /api/ideas` (those fields + `Idempotency-Key` header): embed, take neighbors through `lib/search/neighbors.ts`, place per decision D1, insert version 1 -> the version shape `{"ideaId", "versionId", "parentId", "title", "description", "audience", "problem", "workflow", "constraints", "x", "y", "z", "neighborIds", "corpusVersion", "createdAt"}`.
4. `GET /api/ideas` -> the workspace's ideas with their latest version, same shape.

## Requirements
- Gemini calls go through `lib/ai/` (`generate`).
- `interpret` never writes to the database.
- A retried save with the same idempotency key returns the same version, no duplicate row.
- Ideas belong to the guest workspace; another workspace's request can't read them.

## Validation
1. `interpret` then `POST /api/ideas` -> a row; `GET /api/ideas` returns it with the same x/y/z and corpus version.
2. Same request twice with one key -> one row.
3. `tests/e2e/idea-create-api/` covers 1–2 (Gemini stubbed in the test only), plus one live run noted in the done note. Keep the saved row.

## Defaults
5 neighbors. Gemini model from `GEMINI_MODEL`.

## Multiple ideas and explicit deletion (user request, 2026-10-11)
- Reuse existing POST/GET for independent ideas; creating another must never overwrite the selected idea.
- Add `DELETE /api/ideas/:ideaId`, requiring same-origin and an authenticated workspace. Validate UUIDs;
  missing/foreign IDs both return 404. Delete only that workspace's exact idea with one atomic statement.
  Return `{ideaId, deleted:true}` only after committed deletion. A repeated delete returns 404 and cannot
  delete another idea. No provider call, embedding or schema change is needed.
- Deletion removes the idea, all its versions and their foreign-key-cascaded dependent records. Versions
  remain immutable while they exist. Other ideas and workspace-level team inputs remain unchanged.
- Existing immutable decision snapshots are independent exports, not live versions: retain snapshots and
  their shares. The confirmation must explicitly say these remain and expose existing share revocation.
  This action is not a full workspace/privacy erasure. Do not silently rewrite historical snapshots.
- Do not relax constraints to force deletion. Verify branched versions and dependent rows on the dedicated
  test database; an unexpected dependent-reference failure must leave the whole operation unchanged.
- Validation: two workspace ideas and a foreign workspace; deleting one removes every one of its versions,
  list/restore excludes it, the other idea remains, foreign/malformed/unauthorized/cross-origin requests cannot
  mutate, repeat returns 404, dependent records cascade, and pre-existing snapshots/shares retain their exact
  exported content. Cover the route plus actual database behavior without live model calls.
- Windows worker kiro-agent-1 owns this API follow-up. Coordinate frontend through live-mentor-ui; no second
  schema, storage layer, idea list endpoint or framework.
