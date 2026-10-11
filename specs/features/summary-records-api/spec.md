---
name: The AI says when a neighbour is only a gallery card, and search marks summary-only hits
depends_on: [neighbor-evidence-api, strongest-alternative-api, combinations-api, challenge-api, search]
owns: [lib/evidence/contract.ts, lib/evidence/service.ts, lib/alternative/service.ts, lib/combinations/service.ts, lib/challenge/service.ts, lib/search/neighbors.ts, tests/summary-records-api/, tests/e2e/summary-records-api/]
assignee: ""
---

# Summary-only records: API

Windows (backend). With corpus-summaries, a project can have a title and tagline but an empty description
(the roadmap's corpus goal, #317). Today the four services that quote a neighbour already fall back from
description to tagline to title, but say nothing about it, so a one-line tagline is presented to the model, and
to the user, as if it were the project's write-up.

## Plan
1. In `lib/evidence/service.ts`, `lib/alternative/service.ts`, `lib/combinations/service.ts` and
   `lib/challenge/service.ts`: when the description is empty, the source given to the model says it is a gallery
   card only (title and tagline, no description on record), and the instructions say not to claim anything about
   how the project works beyond that text. The existing exact-quote grounding for "supported" stays as it is.
2. Evidence cards: `Card` (`lib/evidence/contract.ts`) gains `excerptSource: "description" | "tagline" | "title" |
   "unknown"`: which field the stored excerpt came from, found when the response is built by comparing it with the
   project's current description (its first 6,000 characters, as stored), tagline and title. If the project has
   since changed or left the corpus and none matches, it's `"unknown"`, never a guess. No schema change, and older
   stored cards get it too.
3. Search: `Hit` (`lib/search/neighbors.ts`) gains an optional `summaryOnly?: boolean`, true when the description
   is empty. Optional, so `components/search/filters.ts`, which builds `Hit`s from `stars.json`, still compiles.
   `/api/search` returns it unchanged, since it serializes `Hit`.

## Requirements
- Response shapes, additive only: an evidence card is today's card plus `excerptSource`; a server search hit is
  today's hit plus `summaryOnly`. Nothing is removed or renamed.
- Projects with a description behave exactly as today (same prompts, same results).
- No new table, column or migration.

## Validation
1. Route tests in `tests/e2e/summary-records-api/` (where `verify.py` looks) with the AI stubbed at the provider boundary, against a test database with one summary-only project
   (`description = ''`): the prompt for evidence, alternative, combinations and challenge contains the gallery-card
   notice for that project and not for a full one; the evidence response has `excerptSource: "tagline"`; a full
   project's card has `excerptSource: "description"`. Replace the project's text after saving a card -> the card
   reloads with `excerptSource: "unknown"`.
2. `GET /api/search?q=...` returning that project -> `summaryOnly: true`; a full project -> `false`.
3. One live provider run on a summary-only neighbour is recorded in the done note; missing credentials are a gap,
   never a pass. Run the tech-stack Checks and `verify.py --slug summary-records-api --worktree .`.
