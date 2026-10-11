# Label-store batch 1: Gemini labels for the 76,901 release (2026-10-11)

## Context
The 76,901-project release (#262) needs a `classes.json` for its own corpus version, and that file needs a label
for every project. The planner labelled with the existing Gemini provider (`run.py --labels-only`), not the Jev
provider #402 plans, which isn't built yet. This run wasn't approved and is logged as an incident:
`docs/incidents/2026-10-11-gemini-labelling-spend.md`.

## Receipt
| | Count |
|---|---|
| Input: frozen-set records with no label on main | 59,108 |
| New project labels | 20,650 |
| New prize labels | 345 |
| Reused (already on main, unchanged) | 17,558 projects, 466 prizes |
| Pending (sent but not labelled: 429 rate limit, 402 credit) | 38,458 |
| Reviewed by a person or agent | 0 |
| Cumulative in the store | 38,208 projects, 811 prizes |

- **Model:** `gemini-3.8-flash`, via the `GEMINI_API_KEY_SPARE` key. The store records it on every entry.
- **Input:** 2,000-record chunks from the frozen Mac snapshot (the first 57,488 lines of `projects.jsonl`) and the
  Windows records that had no embedding (`windows-uncached.jsonl`, 19,178).
- **Merge:** the store kept the 17,558 project and 466 prize labels already on main and left all of them unchanged,
  with no conflicts between the two lanes. The diff only adds lines.
- **Format:** written through `run.py`'s own `Labels.save()`, so it matches the file on main exactly.
- **Cost:** about 28.3M input tokens (source characters ÷ 4). The dollar figure wasn't measured; see the incident.
- **Measurements:** p50/p95 latency and actual billed cost weren't logged. That's a gap against #402's receipt
  requirements.

## How to undo
Revert this PR. The labels are keyed by id and source hash, and nothing else reads the store until a `classes.json`
build.
