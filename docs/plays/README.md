# Plays

The opposite of [the incident log](../incidents/README.md): things that went right, written down so they get run
again on purpose. Newest first. Times are EDT. Same bar as incidents: only facts you can point to (a log line, a
command's output, a PR), and "unknown" where it is.

| When | Play | Result | Record |
|---|---|---|---|
| 2026-10-11 04:29–05:17 | Labelled the 38,458 projects Gemini couldn't finish with 645 Claude Haiku 5.5 subagents, up to 48 at once across 8 workflows, after a 4-batch pilot, an estimate and the person's explicit yes | 1,680 of 1,680 batches valid; the store covers all 76,666 frozen-set projects (#424). 48 minutes, on the subscription. Review: 0 wrong domains in 112 sampled | [haiku-fanout](2026-10-11-haiku-fanout.md) |

## Adding a play
One row above. For anything worth repeating, also add `YYYY-MM-DD-<slug>.md` with: **What happened**,
**Result** (measured), **Why it worked**, and **Run it again** (the steps). Use a `docs:` PR.
