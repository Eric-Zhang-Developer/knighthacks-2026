---
name: Classify every project by domain, prize kind and reported coding-tool use, with Gemini, offline
depends_on: [corpus-embed, ai-client]
owns: [corpus/classify/, public/classify/, tests/corpus-classify/]
assignee: ""
---

# Corpus classification (#269)

Backend half: Windows workers first. A Mac worker may take it if it stays unclaimed for 15 minutes. User decision
2026-10-10: the galaxy is coloured by category, prize winners are marked by placement and sponsor, and Gemini does the
classification (not Hugging Face). Agreed in #269. Categories come from a fixed domain list, labels are `inferred`,
and unknown stays unknown.

## Plan
1. `corpus/classify/run.py` reads the projects for the current `corpus_version` from Neon (`DATABASE_URL`):
   id, title, tagline, description, technologies, events (with prizes). `--from-jsonl <path>` reads a records file
   instead, for tests.
2. Domains, batched (about 25 records per Gemini call, structured JSON output, `GEMINI_MODEL`, REST through the
   standard library):
   - `domain`: one of the taxonomy v1 ids below.
   - `status`: `clear`, `mixed` (two domains about equally fit; `runner_up` set) or `insufficient_text`
     (`domain` null).
   - `dev_tools`: `reported` / `reported_non_use` / `unknown`, plus `dev_tools_evidence`, a quote. Reported means the
     team says it used a coding assistant (ChatGPT, Copilot, Cursor, Claude Code, Codex, v0, Lovable…) to *build*
     the project, not that the product calls an AI model.
3. Prizes: classify each **distinct** prize string once (there are 263 of 491). `kind` is `placement`, `sponsor`,
   `category`, `participation` or `other`; `place` is 1, 2 or 3 when stated, else null; `sponsor` is a name when
   stated, else null.
4. Write `public/classify/classes.json`: `{corpus_version, taxonomy_version, model, generated_at, domains:[{id,
   label}], projects:{<id>:{domain, status, runner_up, dev_tools, dev_tools_evidence, prizes:[{event, text, kind,
   place, sponsor}]}}}`.
5. Review: an agent checks 50 random projects, 3 per domain, 20 `mixed` or `insufficient_text`, and all 263 prize
   strings. It records correct / incorrect / ambiguous and the share left `insufficient_text` in
   `specs/decisions/corpus-classify-review.md`, marked agent-reviewed.

Taxonomy v1 (14): `health` Health & wellbeing · `education` Education · `finance` Finance · `climate` Climate &
environment · `accessibility` Accessibility · `civic` Civic & social good · `devtools` Developer tools ·
`productivity` Productivity & work · `commerce` Commerce & business · `games` Games & entertainment · `social`
Communication & social · `security` Security & privacy · `science` Science & research · `mobility` Mobility &
transport. "AI agents" is a method, not a domain: an agent that books doctor visits is `health`.

## Requirements
- A prize `place` that the prize text doesn't state ("Winner", "First Runner-Up") becomes null for that prize; it
  doesn't fail the other prizes in its batch.
- Every corpus id appears exactly once, and the counts and `corpus_version` match `public/corpus/stars.json`. The
  script exits non-zero otherwise.
- `dev_tools_evidence` must be a verbatim substring of the stored description. Otherwise the script sets `dev_tools`
  to `unknown` and the evidence to null. No mention means `unknown`, never "not used".
- `domain` is null or one of `domains[].id`; anything else is an error and the batch is retried once.
- A failed batch is retried once. If it still fails, its records become `insufficient_text`, and the count is
  printed. The script never fills in guesses.
- Re-running with the same inputs is safe: it overwrites the file and leaves the database unchanged.
- No API key in the output file or the logs.

## Validation
1. `python3 -m pytest tests/corpus-classify` with Gemini stubbed: contract shape, verbatim-evidence downgrade,
   id/count/version check, prize per distinct string.
2. Full run: `python3 corpus/classify/run.py` → prints records, domain counts, `mixed` and `insufficient_text`
   counts, prize kind counts and calls made. `classes.json` is committed. Keep the printed lines.
3. The review file exists with the numbers from Plan 5.

## Defaults
Labels are stored per project and prize string (`corpus/classify/labels/`), so a grown corpus only labels new rows.
When Gemini has no budget, classification agents may answer the same prompts (`--provider agent`); their answers
pass the same validators, the store records each label's model, and `classes.json`'s `model` lists every model in
it (`specs/decisions/corpus-classify-agent-labels.md`).
Batch size 25, concurrency 4. If the largest domain holds more than 30%, inspect its descriptions before shipping;
don't split it just to balance the chart.


## Proposed Jev provider and incremental labeling (2026-10-11)

Requested by the person after approving six Luna classification workers and merges after roughly 10,000 new
labels. This extends the existing offline classifier; the taxonomy, label schema, evidence rules and release
checks above remain binding. Implementation follows this plan's human merge, in a separate
`fix(corpus-classify): ...` PR. No API credential or live Jev result exists in this plan.

### Implementation
1. Add `--provider jev` to `corpus/classify/run.py`, with a small provider module under `corpus/classify/`.
   Use Python's existing standard-library HTTP client and `OPENROUTER_API_KEY` from the environment, calling
   `https://openrouter.ai/api/alpha/decisions` with pinned model `typesafe/jev-1.13`. No SDK or dependency change.
   Keep Gemini and agent modes working. Provider code receives the original records, not parsed prompt prose.
2. Express the 14 domains plus insufficient evidence as typed choices with explicit descriptions. Ask separately
   about clear/mixed/insufficient status and the runner-up; disagreement between answers goes to review, not a
   guessed repair. Select coding-assistant use versus non-use versus unknown using the existing semantic rules.
3. Jev produces choices, not prose. For a reported tool state, select from numbered verbatim source passages
   plus a no-evidence option, then resolve the selected ID back to the exact description substring. Ask whether
   the passage establishes BUILD-tool use, not product integration. Too many candidates, inconsistent answers,
   unsupported input size or uncertain evidence go to the agent queue. Never invent, paraphrase or silently
   truncate evidence. Summary-only records keep their empty description and cannot acquire a tool-use quote.
4. Deduplicate prize strings globally and classify kind and explicit placement. Sponsor names must be selected
   from source-derived candidates; ambiguous extraction goes to agent review. Run all translated responses
   through the existing `validate_batch`, `project_value` and `prize_value` functions before saving labels.
   A validator downgrade of purported evidence is reported and queued for review, not counted as a successful
   evidence extraction. A close domain probability alone does not establish `mixed`.
5. Start at four concurrent requests, with bounded timeouts, one bounded retry honoring Retry-After for transient
   errors, and a shared pause on rate limits. Authentication, exhausted credit and configuration errors stop the
   run. Refusals, exhausted retries and unresolved questions remain pending; they are not stored as genuine
   `insufficient_text`. Log actual usage, latency, error counts and the provider's returned model identifier.
6. Reuse only source-hash-matching existing labels. Cache raw answers by source, pinned model and question
   revision, save completed validated chunks atomically, and resume without repeating completed paid work.
   Write through the existing per-project/per-prize label store. Record actual model provenance; never label
   Jev output as Luna output. Shared label-store merging has one writer.

### Pilot and acceptance
- Before bulk spending, run 500 distinct real records, including at least 50 summary-only records, all available
  domains, mixed/insufficient examples and positive/negative coding-tool cases. Tune questions on a separate
  development sample; keep the acceptance sample held out. Existing model labels are comparisons, not truth.
- Use six `gpt-6-luna` workers in two waves of three for independent source review and exception handling.
  Reviewers first classify without seeing Jev's answers; the parent adjudicates disagreements against sources.
  Report per-field agreement, errors by domain and record tier, reviewed coverage and unresolved cases.
- Proposed bulk gate: at least 90% domain agreement with adjudicated acceptance labels, all emitted quotes exact
  and semantically supported, no invented prize facts, and no unresolved schema/ID errors. Check minority-domain
  failures rather than hiding them in the aggregate. Derive any confidence threshold on the development sample;
  Jev confidence is not assumed to equal probability of correctness. A failed gate parks bulk Jev work.
- Measure request count, tokens, actual billed cost, p50/p95 latency and validated records/second. Estimate the
  remaining full and summary runs separately from these measurements; publish no benchmark-derived promise.
- Add focused tests for API-to-label translation, invalid IDs/options, contradictory choices, quote selection,
  summary evidence, refusal, rate limits, credit exhaustion, checkpoint resume and provider provenance. Existing
  classification tests, repository Checks and `verify.py --slug corpus-classify` must still pass.

### Incremental PRs and release
- Process the frozen 76,901 full-project snapshot first, then summary-only records separately. Confirm source
  hashes against the release owner's exact input; counts in coordination comments are not cache validation.
- After approximately each 10,000 newly validated labels, publish a separate `fix(corpus-classify): ...` PR
  containing label-store updates and a review/measurement receipt under `specs/decisions/corpus-classify-*`.
  Smaller final batches are allowed. Each PR reports new, reused, reviewed, pending and cumulative counts.
- Each checkpoint gets schema/source/evidence validation and the existing spec review sample (50 random,
  3 per represented domain, 20 mixed/insufficient where available), plus review of every newly added distinct
  prize string. Small batches review all available records when a sample quota cannot be met; document counts.
- Wait for green CI and the repository's whole PR verdict before merging each checkpoint. The person explicitly
  requested these data-sized PRs; explain the generated diff size instead of weakening review or checks.
- Label checkpoints do not modify `public/classify/classes.json` or publish production. The sole release owner
  assembles that file after complete coverage and exact corpus-version/ID checks, shipping it with matching
  stars. Existing saved-idea, deployment, summary-support and milestone gates remain unchanged.

References: [Jev model and pricing](https://openrouter.ai/typesafe/jev-1.13),
[classification cookbook](https://openrouter.ai/docs/cookbook/evaluate-and-optimize/jev-classification),
[confidence evaluation](https://openrouter.ai/blog/insights/jev-vs-claude-opus-5-classification/).
OpenAI's [Decisions API](https://developers.openai.com/api/docs/guides/decisions) is an alternative reviewed by
request; this plan implements Jev only. Undo by removing Jev-origin labels and selecting the existing provider;
previous valid labels and the published corpus remain available.
