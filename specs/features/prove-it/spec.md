---
name: Turn a challenged assumption into a ten-minute experiment and record its result
depends_on: [challenge-ui, ai-client]
owns: [app/api/experiments/, lib/experiments/, components/experiments/, db/schema/experiments.ts, tests/prove-it/, tests/e2e/prove-it/]
assignee: ""
---

# Prove it in ten minutes (F27)

Backlog. It picks up a challenge round that ended in `test`.

## Plan
1. Mount: a separate `fix: mount the experiments panel in the shell` PR adds `<Experiments />` to the right column
   of `app/page.tsx`.
2. `POST /api/experiments`: from a challenge round's assumption, through `lib/ai/`, draft a hypothesis, a procedure
   that fits in ten minutes, and the observable outcome that would confirm or refute it.
3. The user edits the draft, runs it themselves, and records the result: `confirmed`, `refuted` or `inconclusive`
   plus a note.

## Requirements
- Every experiment has all four parts: hypothesis, procedure, observable outcome, recorded result.
- The app never fills in the result; until the user records one it shows "not run".
- A recorded result never edits a version; it can be the context for a revision suggestion.

## Validation
1. End a challenge round with `test` -> a draft with the first three parts; record `refuted` -> it's stored and
   shown on the version.
2. `tests/e2e/prove-it/` covers 1 with Gemini stubbed in the test only. Keep the stored row.

## Defaults
One open experiment per assumption.
