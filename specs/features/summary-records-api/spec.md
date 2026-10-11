---
name: The AI says when a neighbour is only a gallery card, and search marks summary-only hits
depends_on: [neighbor-evidence-api, strongest-alternative-api, combinations-api, challenge-api, search]
owns: [lib/evidence/contract.ts, lib/evidence/service.ts, lib/alternative/service.ts, lib/combinations/service.ts, lib/challenge/service.ts, lib/search/neighbors.ts, tests/summary-records-api/]
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
2. Evidence cards: `Card` (`lib/evidence/contract.ts`) gains `excerptSource: "description" | "tagline" | "title"`,
   which field the excerpt came from. Derive it when the response is built (from the project row, or by comparing
   the stored excerpt with the project's description); no schema change, and older stored cards get it too.
3. Search: `Hit` (`lib/search/neighbors.ts`) gains `summaryOnly: boolean`, true when the description is empty.
   `/api/search` returns it unchanged, since it serializes `Hit`.

## Requirements
- Response shapes, additive only: an evidence card is today's card plus `excerptSource`; a search hit is today's
  hit plus `summaryOnly`. Nothing is removed or renamed.
- Projects with a description behave exactly as today (same prompts, same results).
- No new table, column or migration.

## Validation
1. Route tests with the AI stubbed at the provider boundary, against a test database with one summary-only project
   (`description = ''`): the prompt for evidence, alternative, combinations and challenge contains the gallery-card
   notice for that project and not for a full one; the evidence response has `excerptSource: "tagline"`; a full
   project's card has `excerptSource: "description"`.
2. `GET /api/search?q=...` returning that project -> `summaryOnly: true`; a full project -> `false`.
3. One live provider run on a summary-only neighbour is recorded in the done note; missing credentials are a gap,
   never a pass. Run the tech-stack Checks and `verify.py --slug summary-records-api --worktree .`.
