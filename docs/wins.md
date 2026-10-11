# Wins log

What worked, so it gets kept and repeated. It's the counterpart to [incidents](incidents/README.md). Newest first.
Times are EDT. Same rule as the incident log: every claim points to evidence.

| When | What worked | Why it mattered | Evidence |
|---|---|---|---|
| 2026-10-11 04:29–05:17 | **Labelling on the Claude subscription.** Haiku sub-agents answered all 1,680 batches through `run.py --provider agent` while both Gemini keys were down | It filled the label gap without any API spend, at about 35 batches a minute (1,680 in 48 min) | answer files in the session's scratchpad, first 04:29, last 05:17 |
| 2026-10-11 04:17 | **A before-write gate stopped an overwrite.** codex-corpus-parallel's production transaction aborted because production no longer matched what it had validated | Two agents raced to load production, and nothing was overwritten | [competing-production-loads](incidents/2026-10-11-competing-production-loads.md) |
| 2026-10-11, all night | **A 10-minute monitoring loop.** The planner rechecked main, the live site, the release thread, the keys and the disk every tick | It caught, within one tick: the competing loads (warning on #262 at 08:24Z), the live categories mismatch (#419), Gemini's spend caps (#297) and the disk dropping to 3.8 GB | #262, #297 and #419 comments |
| 2026-10-11 | **Live probes instead of assumptions.** One-token Gemini calls and quota error details showed which limit was hit (402 credit, 429 per minute, 429 monthly cap) | Fixes went to the right place: credit, then the spend cap | #297 |
| 2026-10-11 02:26 | **Sharing the embedding cache across machines.** The Mac's 56,887 vectors were uploaded with a checksum, and Windows verified it | Only Windows' ~19k records needed new embeddings | #262, comments from 06:26Z |
| 2026-10-10 | **Resumable gallery walks at 8 requests a second** (`progress.jsonl`, #360, #366) | No gallery got re-walked after a restart, and the Mac fetch grew to 57,488 full projects | `corpus/fetch/run.py`, #360, #366 |

## Adding a win
One row. Name the mechanism, not just the result, so it can be reused.
