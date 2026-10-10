---
name: Draft a short pitch from what is actually built, and three judge questions about its weak spots
depends_on: [idea-create-api, ai-client]
owns: [app/api/rehearsal/, lib/rehearsal/, db/schema/rehearsal.ts, tests/rehearsal-api/, tests/e2e/rehearsal-api/]
assignee: ""
---

# Demo rehearsal (F18): API

Backend: Windows workers first; a Mac worker may take it if it stays unclaimed for 15 minutes.

## Plan
1. `POST /api/rehearsal/:versionId` with `{"built": [string]}` (what the team says works now, 1–8 items, each at
   most 120 characters): through `lib/ai/`, draft a pitch and three judge questions.
2. Response and `GET`: `{"versionId", "built", "pitch": [{"text", "status": "built" | "planned"}],
   "questions": [{"question", "weakness", "basis": Claim}] (exactly 3)}`.

## Requirements
- Model calls go through `lib/ai/` (`generate`); claims through `checkClaims`.
- A pitch sentence is `built` only when it quotes one `built` item verbatim (checked in `lib/rehearsal/`); otherwise
  it's `planned`. A planned feature is never described as working (V3 F18 acceptance).
- Each question names a weakness tied to a version field or a `built` item; `basis` is `supported` only when it
  quotes that text verbatim, else `inferred`.
- Pitch at most 90 words. Stored per version and `built` list (a hash of the sorted list); the same `POST` again
  returns the stored row with no model call. `GET` returns the newest stored rehearsal for the version, or 404.
- Same workspace session, same-origin and 404 rules as the other idea routes. Apply the table with additive SQL on
  the test branch (#125); production gets it through `db-sync`.

## Validation
1. `POST` with two built items -> a pitch whose `built` sentences each quote one item, and exactly three questions;
   `POST` again -> the same row, no model call.
2. A fixture sentence calling an unlisted feature working, labelled `built` -> downgraded to `planned`.
3. A fixture with two questions -> regenerated once, then 502.
4. `tests/e2e/rehearsal-api/` covers 1–3 with fixtures (`AI_STUB_ALLOW=1`). Keep the stored row.

## Defaults
Each question at most 160 characters.
