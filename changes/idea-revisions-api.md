## What shipped
Revision API: `POST /api/revisions/propose` stores up to 3 field suggestions; `POST /api/revisions/:id/accept` inserts a child version (re-embedded, D1 placement; retry returns the same version); `.../reject` writes nothing; `GET /api/revisions/trail/:ideaId` lists versions oldest first. All workspace-scoped.
## Where it lives
`app/api/revisions/`, `lib/revisions/`, `db/schema/revisions.ts`, `tests/idea-revisions-api/`, `tests/e2e/idea-revisions-api/`; choices in `specs/decisions/idea-revisions-api-suggestions.md`.
## How to check it
verify: `node scripts/verify.mjs idea-revisions-api .git/agent-evidence/idea-revisions-api/20261010T135700Z` pass at 7493efc (Mac; Neon test branch; generation fixture, real HF embeddings). Also run once live on the test branch with the configured providers: propose 200 in ~10 s with 3 suggestions, accept 201 with the right parent and 5 neighbors.
## Gaps
`revision_suggestions` was created on the test branch with additive SQL, not `drizzle-kit push`: a push from this branch would have dropped another in-flight feature's `evidence_cards` table. Production schema is not pushed (#113). Live provider output is not asserted, only its shape.
