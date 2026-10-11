# corpus-classify: label the grown corpus with Claude agents

**Context.** The growth fetch (#262) took the corpus from 8,409 to 17,558 records at the 20:40 EDT snapshot, and it is
still running until 03:00. The main Gemini key's prepaid credits are depleted (HTTP 402). The spare key serves the live
demo and must not be spent on bulk work. Batch caching keyed on whole prompts would also have re-labelled all ~17k rows.
The person asked for Sonnet subagents to do it (2026-10-10).

**Options.** A) Top up Gemini and re-run. B) Label new rows with Claude Sonnet agents answering the identical prompts.
C) Ship the grown corpus with new stars uncoloured.

**Choice.** B, plus a per-project label store, so only the 9,149 new projects and 203 new prize strings need labels. The
8,409 existing labels stay Gemini's (`gemini-3.8-flash`). New labels come from `claude-sonnet-5-5` agents for the first
74 of 119 prompt chunks and `claude-haiku-5-5` agents for the rest (the person switched models mid-run; Haiku matched
Gemini as often as Sonnet did, below). Every answer
passes the runner's own validators: allowed domain ids, the mixed/runner-up rules, and a verbatim quote that names a
tool for reported coding-assistant use. `classes.json`'s `model` lists both models.

**Consistency.** Two models can split borderline cases differently. Before the full run, a Sonnet agent labelled 30
random Gemini-labelled projects blind; agreement is recorded below.

**How to undo.** Drop the agent entries from `corpus/classify/labels/*.jsonl` (`"model":"claude-…"`) and
re-run with Gemini once it has budget; the store sends only those rows again.

## Agreement check (30 Gemini-labelled projects, blind)
A Sonnet agent and then a Haiku agent each labelled 30 random Gemini-labelled projects (seed 7, three 10-record prompts)
without seeing Gemini's labels:

| Agree with Gemini | Sonnet | Haiku |
|---|---|---|
| Domain | 23/30 (77%) | 23/30 (77%) |
| Status | 28/30 | 27/30 |
| Reported coding-tool use | 30/30 | 30/30 |
| Prize kind and place | 3/3 | 3/3 |

Sonnet and Haiku agree with each other on 21/30 domains: they miss different borderline cases.

All 7 domain splits are borderline, both `clear`: Security4her (security / civic), silverlink (accessibility /
health), Your Sky Zone (mobility / games), RFIBot (productivity / commerce), Daylight (education / productivity),
Keeper (security / civic), KnightHacks 0.5 table 33 (games / social). Expect about 1 in 4 new stars to sit in a
defensible neighbouring domain from Gemini's choice. Categories are labelled `inferred` in the UI, and search never
uses them.

## Result (17,558-record snapshot)
| Model | Projects | Prize strings | Clear | Mixed | Insufficient text | Reported coding tool |
|---|---|---|---|---|---|---|
| gemini-3.8-flash | 8,409 | 263 | 94.5% | 4.7% | 0.8% | 4.7% |
| claude-sonnet-5-5 | 5,820 | 0 | 95.9% | 3.3% | 0.8% | 11.2% |
| claude-haiku-5-5 | 3,329 | 203 | 98.3% | 0.7% | 1.1% | 10.9% |

A re-run over the merged store sends nothing (`pending_projects: 0, pending_prizes: 0`). Every `reported` label's
quote is verbatim from the record and names a tool.

**Known gap: reported tool use is not comparable across models.** In the same start months the agents mark about twice
as many projects `reported` as Gemini did (Aug 2026: 9.2% vs 3.4%; Sep 2026: 11.2% vs 5.2%). Spot-checked agent quotes
are real build-tool use ("we built Farm Hand with Gemini in Google AI Studio", Codex and Claude Code mostly), so
Gemini likely under-reported. Mixed labels also run lower for agents. Era-board counts that mix providers should be read
as a floor; re-labelling the Gemini rows with one agent model would make them comparable.
