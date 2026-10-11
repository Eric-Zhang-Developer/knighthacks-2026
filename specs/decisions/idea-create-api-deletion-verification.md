# Confirmed idea deletion verification

## Temporary rollout boundary
Hosted previews can point at production data. Until separately approved production rollout and verification,
the DELETE route returns safe 503 unless DATABASE_URL equals the nonblank TEST_DATABASE_URL. This server-side
check is independent of UI visibility and does not serialize either value. It allows the normal production-build
verifier on the dedicated test database; NODE_ENV alone is not evidence of database identity. No enable switch
or production mutation is introduced. Removing this temporary restriction requires the coordinated production
rollout, not a UI-only change; ordinary production idea creation/listing are unaffected.

Plan #443; implementation #448, worker kiro-agent-1. The baseline main abbd5c0 has no
`app/api/ideas/[ideaId]/route.ts` (`git cat-file -e` fails). The new route returns an authenticated,
same-origin, workspace-scoped deletion receipt and retains independent snapshot/share exports.

At 19280d6, the committed `tests/e2e/idea-create-api/delete.spec.ts` passed against the dedicated
TEST_DATABASE_URL through an isolated Next development server (1 passed, 40.9 seconds). No provider calls:
synthetic test workspaces, ideas, branched versions, evidence, snapshot and share are created and cleaned up.
The test verifies anonymous/cross-origin/foreign/malformed rejection, successful delete and repeat404,
version/evidence cascades, other-idea preservation, list/restore removal and unchanged snapshot/share data.
The scratch harness changes only the server launch from build/start to dev; repository verifier configuration
and all committed assertions remain unchanged. This is actual API/database evidence, not production acceptance.

Unit suite: 556 passed, 3 skipped with one worker; typecheck, lint, ownership, gates and markers passed.
Parallel full runs timed out in two unchanged Foreman tests under memory contention; their focused run and
the serial complete suite passed without timeout changes. The first actual DB fixture had an unquoted
reserved `overlaps` column; 19280d6 fixes the fixture, without changing the API.

Required full verifier is still blocked: cold and warm production build/start exceeded its unchanged
240-second readiness budget. Last receipt: `verify: node scripts/verify.mjs idea-create-api
20261011T104001Z FAIL (exit 1)` at dcf179c with the fixture correction then uncommitted.
Evidence is in `.git/agent-evidence/idea-create-api/20261011T104001Z`. No validation was weakened.
Mac verification request and attempts are recorded on #446, #448 and coordination #269.
Do not mark full release verification or human phone/voice acceptance complete from the development test.

## Final production-build verifier receipt (October 11)
The canonical verifier passed unchanged at390f5dc after using the existing Windows pnpm.exe launcher.
`verify: node scripts/verify.mjs idea-create-api 20261011T112033Z pass at390f5dc`.
Both committed tests passed (3.7minutes): real built-app creation/placement/idempotency using HF and TEST Neon,
and deletion authorization/cascades/export preservation. Generation used the committed fixture; embeddings
and database operations were real. Evidence: `.git/agent-evidence/idea-create-api/20261011T112033Z`.
This supersedes the startup-timeout blocker above. Production deletion remains disabled by the explicit TEST
identity guard; no production database write or broader human voice acceptance is implied.
