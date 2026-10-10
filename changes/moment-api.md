## What shipped
`POST /api/moment/:versionId` drafts exactly three judge steps (`judgeDoes`, `appears`, `demonstrates`, each ≤160 chars) plus a `basis`, stores one row per version, and returns the stored row on later POSTs without a model call; `GET` reads it (404 if none). Claims are `supported` only when they quote the version's own fields verbatim, citing the version; otherwise `inferred`. Incomplete drafts are retried once, then 502.
## Where it lives
`app/api/moment/`, `lib/moment/`, `db/schema/moment.ts`, `tests/moment-api/`, `tests/e2e/moment-api/`; test-branch SQL in `specs/decisions/moment-api-schema.md`.
## How to check it
verify: `node scripts/verify.mjs moment-api .git/agent-evidence/moment-api/20261010T165331Z` pass at 79852f4 (Mac; Neon test branch; real sessions and saves; generation fixtures). Also run once live on the test branch with the configured providers: 200 in ~13 s, 3 complete steps, written as planned, quoted claims supported and the rest inferred.
## Gaps
Production schema pending (#113). The live run's model output is checked by eye, not asserted.
