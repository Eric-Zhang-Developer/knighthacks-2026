# corpus-classify: label the grown corpus with Claude Sonnet agents

**Context.** The growth fetch (#262) took the corpus from 8,409 to 17,558 records at the 20:40 EDT snapshot, and it is
still running until 03:00. The main Gemini key's prepaid credits are depleted (HTTP 402). The spare key serves the live
demo and must not be spent on bulk work. Batch caching keyed on whole prompts would also have re-labelled all ~17k rows.
The person asked for Sonnet subagents to do it (2026-10-10).

**Options.** A) Top up Gemini and re-run. B) Label new rows with Claude Sonnet agents answering the identical prompts.
C) Ship the grown corpus with new stars uncoloured.

**Choice.** B, plus a per-project label store, so only the 9,149 new projects and 203 new prize strings need labels. The
8,409 existing labels stay Gemini's (`gemini-3.8-flash`). New labels come from `claude-sonnet-5-5` agents. Every answer
passes the runner's own validators: allowed domain ids, the mixed/runner-up rules, and a verbatim quote that names a
tool for reported coding-assistant use. `classes.json`'s `model` lists both models.

**Consistency.** Two models can split borderline cases differently. Before the full run, a Sonnet agent labelled 30
random Gemini-labelled projects blind; agreement is recorded below.

**How to undo.** Drop the agent entries from `corpus/classify/labels/projects.jsonl` (`"model":"claude-sonnet-5-5"`) and
re-run with Gemini once it has budget; the store sends only those rows again.

## Agreement check (30 Gemini-labelled projects, blind)
_pending: filled in from the pilot_
