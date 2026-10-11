# Jev 500-project trial — 2026-10-11

Worker: eric-codex-agent-1. Implementation PR: #403. Outcome: keep draft; do not merge labels or start bulk work.

## Input and method

500 distinct real projects: 400 full descriptions and 100 summary-only records, selected with seed 20261011
from the frozen Mac/Windows corpus union and Mac summaries. The input JSONL SHA-256 is
`d9abaee3b35d5e73772fdc9edfd303cda8aac37d213f5e5a7b7c96fbc318ad0b`.
The sample contains 24 distinct prize strings. A separate 20-project development sample was used before the
pilot; revision 2 asks for a runner-up only after a mixed decision. No pilot prompt tuning or paid rerun followed.
Returned model: `typesafe/jev-1.13-20260917`. Four concurrent requests, existing taxonomy and validators.
Raw responses, source input and trial label stores remain local under `/private/tmp/eric-codex-agent-1-jev/`.

## Measured result

524 requests, 966,811 input tokens, $0.040606062 reported cost, 108.113 seconds wall time.
Request latency: p50 0.759 seconds, p95 1.015 seconds. No transport/API errors reported.
470/500 projects validated (94%; 4.35 validated projects/second), plus 24/24 prize strings.
30 projects remain pending: 19 tool-state/evidence conflicts and 11 domain/status contradictions
(7 "unknown domain must be null", 4 "invalid domain or runner-up"). The process correctly exited 1.
Saved project statuses: 453 clear, 17 insufficient_text, 0 mixed.
Saved tool states: 65 reported, 3 reported_non_use, 402 unknown. All 470 source hashes and translated values
passed the unchanged validator, including exact-substring evidence checks. This is not a semantic accuracy claim.

## Output inspection and decision

Three Luna reviewers finished 251 independent source assessments. On the 240 overlapping saved Jev labels,
200 domains agreed (83.3% raw agreement). Existing labels and Luna answers are comparisons, not ground truth;
this is not adjudicated accuracy. The person then requested less reviewing, so remaining reviewers were stopped
and no further reviewer wave was started. The planned six-worker benchmark and 90% adjudicated gate are incomplete.
A brief source inspection found an unsupported confident games label for "Sp panel" (mostly empty template text)
and a questionable devtools label for "Hackatron" (event logistics and organizer notifications).
These findings plus unresolved contradictions are enough to park bulk use without commissioning more reviews.
All emitted evidence has not been semantically adjudicated and all prize facts have not been manually checked.
No trial labels or public artifacts were merged. No extrapolated full/summary spending estimate is asserted.

## Validation and undo

81 classifier tests passed, including 19 focused Jev tests. Typecheck and lint passed; app tests: 492 passed,
2 skipped. Required verification passed with the uncommitted implementation:
`node scripts/verify.mjs corpus-classify /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/corpus-classify/20261011T081513Z`.
CI status is recorded separately on PR #403; local checks are not a merge or production verification.
Undo: close the draft and remove the isolated trial cache/labels; existing providers and published labels are untouched.
