---
name: Run every AI route once against the real providers and check what comes back
depends_on: [ai-client, idea-create-api, neighbor-evidence-api, idea-revisions-api, challenge-api, branches-api, compare-api, decision-snapshot-api, strongest-alternative-api, prove-it-api]
owns: [tests/live-smoke/, tests/e2e/live-smoke/]
assignee: ""
---

# Live smoke (Functionality criterion, mission claim rules)

Every AI feature so far passed its Validation against test fixtures; none has been checked against real model
output in one run (their done notes say so). Functionality is scored on "works end to end, reliably"
(`specs/context/event.md`), and the mission's claim rules only matter if real output keeps them. Either machine.

## Plan
1. `tests/e2e/live-smoke/`: through the real routes against the test database, with fixtures off: start a
   workspace, interpret and save an idea, generate evidence, propose and accept a revision, run one challenge round
   and answer it, suggest and accept a branch, compare two versions, get the strongest alternative, draft an experiment from a
   `test` round (if the live critic gives one), freeze a snapshot.
2. At every step assert the mission's rules on the real output, never the wording: every `Claim`-typed field's
   label is `supported`, `inferred` or `unverified`; every `supported` claim cites only sources that step was given; the
   challenge question names an assumption and a source or test; compare has no numeric score.
3. Run one pass per configured provider, with only that provider's key set, because `generate()` falls back
   silently and routes don't report a provider. Record per route and pass: status and latency.
4. List every model-generated text field that carries no label (such as revision `reason`) in the done note as a
   finding; don't fail on it.

## Requirements
- Fails if `AI_STUB_ALLOW` or `AI_STUB_DIR` is set: this run proves live output or nothing.
- Never asserts model wording; only structure and the mission's rules.
- Cleans up its own workspace rows on the test database.
- A provider failure fails the run and names the route; it is never retried silently past the client's own budget.

## Validation
1. `python3 .agents/scripts/verify.py --slug live-smoke --worktree .` -> pass with live keys; the evidence folder
   keeps each route's response (no keys, no cookies).
2. Set `AI_STUB_ALLOW=1` -> the run refuses to start.
3. The done note lists each route's latency per provider pass, any route that failed, and the unlabelled fields.

## Defaults
One run per invocation; no load testing.
