# corpus-classify: Haiku agents label the rest of the frozen set (receipt)

**Context.** The 76,901 release needs labels for every record. #412 merged the planner's 20,650 Gemini labels and
stopped there: both Gemini keys were exhausted ([incident](../../docs/incidents/2026-10-11-gemini-labelling-spend.md)).
The person asked for Claude Haiku 5.5 subagents to do the rest, and approved the run after a pilot and an estimate.

**Options.** A) Wait for Gemini budget. B) Haiku agents answering the runner's exact prompts (`--provider agent`), as
in [agent-labels](corpus-classify-agent-labels.md). C) Ship the release with these stars uncoloured.

**Choice.** B. Every answer passed `check_answer`, the same validators as the Gemini path, before ingest.
Agents read wrapped copies of each prompt (one JSON line is up to 231 KB, too long for their tools to show); answers
were checked against the original prompt. The person asked for one fast run rather than ~10k checkpoints, so this
is one PR; the review below covers it as a whole.

**How to undo.** Drop the store rows with `"model":"claude-haiku-5-5"` that #412's store didn't have, and re-run
with another provider; the store sends only those rows again.

## Run
- **Input:** the planner's 59,108-record frozen set (its 2,000-record chunks), against #412's 38,208-label store.
- **Left to label:** 38,458 projects and 3,507 prize strings, as 1,680 batches (25 per batch). 1,680 of 1,680
  answers valid, 0 invalid. Final ingest: `{"answers_used":1680,"labelled":59108,"pending_prizes":0,"pending_projects":0,"records":59108}`.
- **Store after:** 76,666 projects (every distinct id in the frozen set) and 4,318 prize strings.
- **Agents:** 645 Haiku 5.5 subagents, answers written 04:29–05:17 EDT, on the person's Claude subscription. Tokens
  from the agents' transcripts: 82.2M cache writes, 668.1M cache reads, 1.4M output.

| Model | Projects | Clear | Mixed | Insufficient text | Reported coding tool |
|---|---|---|---|---|---|
| claude-haiku-5-5 (all, incl. 3,329 earlier) | 41,787 | 94.8% | 2.8% | 2.3% | 5.6% |
| gemini-3.8-flash | 29,059 | 93.8% | 5.0% | 1.2% | 22.1% |
| claude-sonnet-5-5 | 5,820 | 95.9% | 3.3% | 0.8% | 11.2% |

## Review (Sonnet 5.5 reviewer agents read the full source; nobody has reviewed these by hand)
Sample from this run's new labels only, seed 20261011, the groups of [the review](corpus-classify-review.md):

| Group | n | Domain correct / incorrect / ambiguous | dev_tools correct / incorrect / ambiguous |
|---|---|---|---|
| 50 random | 50 | 41 / 0 / 9 | 46 / 2 / 2 |
| 3 per domain (14 domains) | 42 | 33 / 0 / 9 | 40 / 0 / 2 |
| 20 mixed or insufficient_text | 20 | 14 / 0 / 6 | 20 / 0 / 0 |
| All distinct ids | 112 | 88 / 0 / 24 | 106 / 2 / 4 |

Ambiguous domains are defensible neighbours (medical billing: finance or health). Both incorrect dev_tools are
explicit build-tool statements the validator doesn't recognise (GenSpark, MeDo), downgraded to `unknown`.

**Prize strings:** 3,504 of the 3,507 new strings reviewed: 3,214 correct, 238 ambiguous, 52 incorrect (1.5%).
Most incorrect ones are explicit places the validator blanked: non-English or superscript ordinals
("1º Lugar", "Primer Lugar", "Prix 1ère place", "3ʳᵈ place", "III miejsce").

## Known gaps
- **The validator undercounts coding-tool use.** Of 4,319 Haiku `reported` answers, 2,334 were downgraded because
  the quote names no tool in `TOOL`: Figma Make (214), Antigravity (169), Google AI Studio (~70), Kiro (51), Base44
  (46), Devin, Junie, Trae, Cline, Roo, Amazon Q, MeDo, GenSpark. Only 11 failed the verbatim check. Quotes like "AI
  helped with boilerplate" are rightly rejected. Extending `TOOL` and re-ingesting would restore the named ones; every
  provider is affected, so tool-use rates are a floor and not comparable across models.
- **Prize places in other languages** are blanked by the place check (`\b1\b` misses "1º", "1ˢᵗ"; no "primer",
  "lugar", "ère"). Kind is unaffected.
- `classes.json` is not rebuilt here (the release owner assembles it). `test_saved_artifact_matches_current_stars`
  fails on origin/main too: `stars.json` is at 2026-10-11-57301, `classes.json` at 2026-10-10-8409.
