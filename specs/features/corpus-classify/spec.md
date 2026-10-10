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
Batch size 25, concurrency 4. If the largest domain holds more than 30%, inspect its descriptions before shipping;
don't split it just to balance the chart.
