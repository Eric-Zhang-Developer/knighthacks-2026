---
name: Turn a challenged assumption into a ten-minute experiment and store its recorded result
depends_on: [challenge-api, ai-client]
owns: [app/api/experiments/, lib/experiments/, db/schema/experiments.ts, tests/prove-it-api/, tests/e2e/prove-it-api/]
assignee: ""
---

# Prove it in ten minutes (F27): API

Backend half (user decision 2026-10-10: backend is Windows). Windows workers first; a Mac worker may take it if it
stays unclaimed for 15 minutes. It picks up a challenge round whose outcome is `test`
(`specs/decisions/challenge-api-rounds.md`).

## Plan
1. `POST /api/experiments` `{"sessionId", "round"}`: from that round's assumption, through `lib/ai/`, draft
   `{"hypothesis", "procedure", "observable"}`; the procedure fits in ten minutes.
2. `PATCH /api/experiments/:id` edits those three fields, or records `{"result": "confirmed" | "refuted" |
   "inconclusive", "note"}`.
3. `GET /api/experiments?versionId=` lists the version's experiments: `{"id", "assumption", "hypothesis",
   "procedure", "observable", "result": ... | null, "note"}`.

## Requirements
- Every experiment has hypothesis, procedure and observable before it can take a result.
- The server never fills in a result; until the user records one it is `null` ("not run").
- A recorded result never edits a version.
- Only a round with outcome `test` can start one; otherwise 409. Same session and same-origin rules as challenge.
  Apply the table with additive SQL on the test branch; never `drizzle-kit push` from a feature branch (#125).

## Validation
1. A `test` round -> `POST` returns a draft with all three parts and `result: null`; `PATCH` `refuted` -> stored;
   the idea's versions are unchanged.
2. A round with another outcome -> 409.
3. `tests/e2e/prove-it-api/` covers 1–2 with fixtures (`AI_STUB_ALLOW=1`). Keep the stored row.

## Defaults
One open experiment per assumption.
