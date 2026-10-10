---
name: Map an idea version onto the event's tracks, separating requirement, demonstration and speculation
depends_on: [decision-snapshot-api, ai-client]
owns: [app/api/rubric/, lib/rubric/, db/schema/rubric.ts, tests/rubric-overlay-api/, tests/e2e/rubric-overlay-api/]
assignee: ""
---

# Rubric and sponsor overlay (F11): API

Backend half (user decision 2026-10-10: backend is Windows). Windows workers first; a Mac worker may take it if it
stays unclaimed for 15 minutes. The tracks are this event's real ones, from `specs/context/prizes.md` (and the
rubric from `specs/context/event.md`).

## Plan
1. `lib/rubric/tracks.json`: one entry per track in `prizes.md` (general and sponsor), with `id`, `name` and
   `rewards` copied verbatim from its "What it rewards" column, plus `source: "specs/context/prizes.md"`. A track
   whose requirement the file doesn't state gets `rewards: null`, never a paraphrase.
2. `POST /api/rubric/:versionId`: through `lib/ai/`, for each track return `{"trackId", "requirement",
   "stated": [Claim], "speculative": [Claim], "proof": null}`. A `stated` claim says what the idea itself says it
   will do, quoting the version's own fields; everything else goes in `speculative`, labelled `inferred` or
   `unverified`. Neither is proof that anything runs: only an attached `proof` is.
3. `PATCH /api/rubric/:versionId/:trackId` `{"proof"}`: the user attaches a link or note as proof. `GET` reads the
   stored overlay.

## Requirements
- Every track entry traces to a row of `prizes.md`; no track, prize or requirement is invented.
- A `stated` claim must contain a verbatim substring of one of the version's fields; `lib/rubric/` checks the
  substring itself (`checkClaims` only checks source IDs). A claim that fails moves to `speculative`.
- No generated score, rank or chance of winning (mission: empty space is never presented as chance of winning).
  Numbers and identifiers quoted verbatim from `prizes.md` or the idea stay as written.
- Stored per version; a second `POST` returns it. Additive SQL on the test branch, never `drizzle-kit push` from a
  branch (#125).

## Validation
1. Every entry in `tracks.json` matches a `prizes.md` row (a unit test parses the table and compares).
2. `POST` for a saved version -> one result per track; each `requirement` equals that track's `rewards` in
   `tracks.json` (or `null` where it is `null`), and no generated score, rank or chance-of-winning estimate
   appears; numbers quoted verbatim from `prizes.md` or the idea's own text are kept as they are. A `stated` claim without a
   verbatim quote of the version moves to `speculative`.
3. `PATCH` a proof -> stored; `GET` returns it.
4. `tests/e2e/rubric-overlay-api/` covers 2–3 with fixtures (`AI_STUB_ALLOW=1`). Keep the stored row.

## Defaults
General tracks first, then sponsor tracks, in `prizes.md` order.
