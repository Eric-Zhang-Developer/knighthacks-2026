---
name: Run a ten-minute experiment from a challenge round and record what happened
depends_on: [prove-it-api, challenge-ui]
owns: [components/challenge/, tests/prove-it-ui/, tests/e2e/prove-it-ui/]
assignee: ""
---

# Prove it in ten minutes (F27): UI

Frontend half: Mac workers only (user decision 2026-10-10). The challenge panel is done, so this feature owns
`components/challenge/` and renders experiments inside it: no shell change. Build on the shape pinned in
`prove-it-api`.

## Plan
1. When a round ends with `test`, offer "Prove it in ten minutes": show the drafted hypothesis, procedure and
   observable as editable fields.
2. Record the result (confirmed, refuted, inconclusive) and a note.
3. An experiments list for `activeIdeaVersionId`, from `GET /api/experiments`, each with its assumption and
   round number, so experiments survive a reload even though challenge rounds live only in the page.

## Requirements
- Until the user records a result, it reads "not run"; the UI never implies an outcome.
- The hypothesis shows its `ClaimBadge` (`unverified`), as every displayed claim must (mission).
- The challenge panel's own e2e still passes unchanged.

## Validation
1. End a round with `test` -> the draft with three parts; record `refuted` -> after reload it shows in the
   version's experiments list with its assumption, round and result.
2. A round with another outcome -> no experiment offer.
3. `tests/e2e/prove-it-ui/` covers 1–2, and `tests/e2e/challenge-ui/` still passes. Keep a screenshot.

## Defaults
The note is optional, one paragraph.
