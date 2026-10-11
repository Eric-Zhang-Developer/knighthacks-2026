# Play: 645 Haiku agents label the corpus Gemini couldn't finish (2026-10-11)

## What happened
- **The gap.** The 76,901-project release needed labels. The planner's Gemini run stopped at 04:05 after 20,650
  of 59,108 records ([incident](../incidents/2026-10-11-gemini-labelling-spend.md)): both keys were exhausted.
- **Reuse first.** Those 20,650 paid-for labels were in the planner's scratchpad and merged in #412, so only
  38,458 projects and 3,507 prize strings were left: 1,680 batches of `run.py --provider agent`'s exact prompts.
- **Pilot.** One Haiku agent answered 4 batches (100 projects, 25 prizes) in 2 minutes; all 4 passed
  `run.py --check-answer` first try. Measured: 167k cache-write and 658k cache-read tokens.
- **Estimate, then ask.** Scaled from the pilot: ~450M tokens, mostly cache reads (about $150–250 if it had been
  API-billed at assumed Haiku-tier rates), ~3 hours. The person said "Yes, run all of it" before anything fanned
  out. The agents ran on the person's Claude subscription, so the real cost was usage-limit headroom, not dollars.
- **Fan-out.** 446 size-balanced groups (~90k tokens each), one Haiku 5.5 agent per group. It started as one
  workflow, 6 agents at a time (the 8-CPU cap), and grew to 8 workflows (see the addenda). Answers landed from
  04:29 (pilot) to 05:17.

## Result
- **Labels.** 1,680 of 1,680 batches valid under `check_answer`, 0 invalid. Ingest printed `labelled 59108,
  pending_projects 0, pending_prizes 0`. The store covers all 76,666 distinct frozen-set projects, plus 4,318 prize
  strings. Merged in #424.
- **Review.** Sonnet reviewer agents read the full source of 112 sampled new labels: 0 wrong domains (88 correct,
  24 defensible neighbours), coding-tool state 106 / 2 wrong / 4 ambiguous. Both wrong ones, and most of the 52 wrong
  of 3,504 prize strings, were the validator's tool list and place check, not the model
  ([receipt](../../specs/decisions/corpus-classify-haiku-frozen-set.md)).
- **Agents and tokens.** 645 Haiku agents. 82.2M cache-write, 668.1M cache-read and 1.4M output tokens: about
  750M, **about two-thirds over the 450M estimate** (each agent re-reads its growing context every turn, more than
  the 4-batch pilot showed). On the person's subscription; no API key, no errors from the API.
- **Time.** 48 minutes of answers against the ~3-hour estimate, because of the addenda below.

## Why it worked
- **The validator is the judge, not the model.** Every answer passes the runner's own checks (allowed domains,
  mixed/runner-up rules, a verbatim quote naming a known tool), so a confident wrong answer can't reach the store.
  The pilot agent counted Figma Make and Base44 as coding assistants; the validator downgraded both to `unknown`.
- **No line too long to read.** Prompts are one JSON line of up to 231 KB, longer than agent tools display. Agents
  read wrapped copies (`view/`), and answers are checked against the original prompt.
- **Answers are files.** A dead agent or a usage limit loses one group; rerunning skips everything already valid.
- **No shared keys.** No Gemini, OpenRouter or production credential was touched.

## Run it again
1. Look for labels already paid for before labelling anything (scratchpads, open PRs, the store on `main`).
2. `run.py --provider agent --answers DIR --labels-only --from-jsonl rows.jsonl --labels corpus/classify/labels`
   writes one prompt per unlabelled batch.
3. Make wrapped views, then pilot one agent on ~4 batches and measure its tokens.
4. Give the person a token estimate (and dollars, if it's API-billed) and wait for a yes to that exact job.
5. Fan out over size-balanced groups; report spend as it accrues.
6. Re-validate every answer, then rerun step 2's command: it ingests them and lists what's still pending.
7. Have a different model review the spec's sample (50 random, 3 per domain, 20 mixed or insufficient) before the PR.

## Addendum: the 6-agent ceiling was per workflow
- **What we saw.** One workflow ran at most 6 agents at once (its cap is CPUs − 2; this Mac has 8): about
  9 batches a minute from 04:35, which put the finish near 07:45.
- **The fix.** The cap is per workflow, and the agents wait on the API, not the CPU. At about 04:39 the run was stopped
  (37 answers kept, every one re-validated) and relaunched as 4 workflows over interleaved slices of the 430
  groups left: up to 24 agents at once.
- **Measured.** A 55-a-minute burst at 04:43 as 24 first groups finished together, then a sustained 29 a minute
  (04:51–04:53): about 3× the single workflow, not 4×.
- **Run it again.** Before a long fan-out, check the per-workflow cap against the job: split the work list into K
  disjoint slices (`j % K == k`) and launch K workflows. Have agents skip any answer that already validates, so a
  stop and relaunch loses nothing.

## Addendum 2: 8 workflows, from both ends
- **What we did.** At 04:59, 812 batches in 194 groups were left. The person asked for 4 more workflows. They took
  the unanswered groups from the back of the list while the first 4 kept going from the front: up to 48 agents.
- **Measured.** 89 batches a minute sustained (05:01–05:04), up from 29. All 1,680 were answered by 05:17. Zero API
  errors in any agent transcript.
- **What it cost.** Where the two directions met, a few groups were answered twice; agents found the other's answer
  file and rewrote or skipped it. One agent saw `--check-answer` fail on every file for a while (the runner's
  catch-all error; cause unknown) and then pass again. A full re-validation at the end found 0 invalid answers, so
  neither left a mark.
- **Run it again.** Ask how many workflows before launch, not mid-run. For a second wave, list what's unanswered
  and split that, so no two workflows hold the same group. Always re-validate every answer at the end, in one
  process, before ingest.
