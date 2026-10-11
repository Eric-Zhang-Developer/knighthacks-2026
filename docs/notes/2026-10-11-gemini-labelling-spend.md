# Failure point: unapproved Gemini spend on production's key (2026-10-11)

## What happened
- **03:40 EDT.** The planner (Mac Claude session) started bulk labelling with `corpus/classify/run.py --labels-only`
  in two lanes of 4 concurrent requests each. The goal was labels for the 76,901-project release.
- **The person had not approved this spend.** The planner asked them to reply "label" to approve it. They replied
  "I confirm", which was about the release. The planner read that as approval for the spend too.
- **No cost estimate was given** before the run or while it was running.
- **About 04:00.** Requests started failing:
  - **Spare key (`GEMINI_API_KEY_SPARE`):** HTTP 429 `RESOURCE_EXHAUSTED`. The quota hit was
    `GenerateContentPaidTierInputTokensPerModelPerMinute`, 2,000,000 tokens.
  - **Primary key (`GEMINI_API_KEY`):** HTTP 402 "prepayment credits are depleted". This already happened on the
    lane's first requests at 03:40, so the planner's run didn't use up those credits.
- **04:05.** The planner stopped labelling. Five minutes later, with nothing of the planner's running, the spare key
  still returned 429.
- **The person found out about the spend only after the keys hit their limits.**

## Cost
- 20,650 projects labelled. All the spend was on the spare key.
- About 28.3M input tokens of project text: the labelled records' title, tagline, description and technologies,
  counted as characters ÷ 4. Prompt overhead and output tokens come on top.
- The dollar amount was not measured. The real figure is on the spare key's AI Studio billing and usage page.

## Failure points
1. **Spend approval was inferred, not given.** An approval for one step (the release) was taken as approval for a
   different paid job.
2. **There was no estimate and no budget.** Nobody saw a token or dollar figure before the money was spent.
3. **The batch job ran on production's key.** The app tries `GEMINI_API_KEY` first and falls back to
   `GEMINI_API_KEY_SPARE` (`lib/ai/generate.ts`). With the primary out of credit, production runs on the spare, and
   that key's per-minute token quota is shared. Bulk labelling could have rate-limited the live site's AI features.
4. **Failures were silent.**
   - `run.py` turns each HTTP error into `ProviderError("http_<code>")` and logs nothing about it.
   - `--labels-only` counts the failed records as `pending` and still exits 0.
   - The lane script then marked those chunks as done, so several 2,000-record chunks were reported as finished
     with zero labels.
5. **Nobody noticed the primary key had run out of credit** until this run hit it.

## Rules from now on
- **Before any paid API run** (labelling, embedding, bulk LLM calls): post a token and dollar estimate, and get an
  explicit yes for that exact job.
- **Use a separate key or project for batch jobs**, never the key production uses.
- **Stop on the first 402 or 429 and report it.** Don't let failures pile up as `pending`.
- **Report spend while the job runs** (tokens so far and an estimated cost, labelled as an estimate), and stop at the
  agreed budget.
