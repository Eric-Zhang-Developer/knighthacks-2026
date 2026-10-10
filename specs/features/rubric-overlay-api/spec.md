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
   "demonstrated": [Claim], "speculative": [Claim], "proof": null}`. `demonstrated` claims quote the version's own
   fields; everything else goes in `speculative`, labelled `inferred` or `unverified`.
3. `PATCH /api/rubric/:versionId/:trackId` `{"proof"}`: the user attaches a link or note as proof. `GET` reads the
   stored overlay.

## Requirements
- Every track entry traces to a row of `prizes.md`; no track, prize or requirement is invented.
- A `demonstrated` claim must quote the version text it relies on (`checkClaims` against the version's fields);
  otherwise it moves to `speculative`.
- No score, rank or chance of winning (mission: empty space is never presented as chance of winning).
- Stored per version; a second `POST` returns it. Additive SQL on the test branch, never `drizzle-kit push` from a
  branch (#125).

## Validation
1. Every entry in `tracks.json` matches a `prizes.md` row (a unit test parses the table and compares).
2. `POST` for a saved version -> one result per track, each with a requirement or `null`, and no number anywhere.
   A `demonstrated` claim without a quote of the version is rejected to `speculative`.
3. `PATCH` a proof -> stored; `GET` returns it.
4. `tests/e2e/rubric-overlay-api/` covers 2–3 with fixtures (`AI_STUB_ALLOW=1`). Keep the stored row.

## Defaults
General tracks first, then sponsor tracks, in `prizes.md` order.
