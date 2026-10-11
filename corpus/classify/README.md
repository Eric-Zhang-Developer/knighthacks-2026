# Offline corpus classification

Run from the repository root with Python 3.11. Install the existing database dependency pinned in
`corpus/embed/requirements.txt` (`psycopg[binary]==3.2.12`); Gemini uses only the standard library.
Provide `DATABASE_URL`, `GEMINI_API_KEY` and `GEMINI_MODEL` through your local environment, never CLI arguments.
A python.org macOS Python has no CA bundle; set `SSL_CERT_FILE=/etc/ssl/cert.pem`, or every call fails as a transport error.

```sh
python corpus/classify/run.py
python corpus/classify/run.py --check
python -m pytest tests/corpus-classify
```

The database connection is read-only and selects the exact version in `public/corpus/stars.json`.
Alternatively, `--from-jsonl records.jsonl` accepts complete source rows, including `corpus_version`.
`--stars` and `--output` allow isolated fixtures. Each source ID must match the star manifest exactly.
The default output is `public/classify/classes.json`. Its categories are **inferred**, never verified facts.

Batches contain at most 25 full descriptions, with at most 4 concurrent calls (both configurable downward).
Each returned index must occur exactly once; response ordering cannot silently swap project labels.
Invalid results retry once, then become unknown. Authentication/model/request-configuration failures abort
after one retry. A first batch runs before the rest to detect configuration problems cheaply.
The saved artifact contains no prompt, source description, source URL, credential or database connection string;
reported development-tool use includes only a checked verbatim evidence quote from the source description.
Product integrations with AI models do not establish coding-assistant use.
Replit editor/hosting mentions alone remain unknown; the quote must identify Replit Agent or AI.

Successful batches are cached by model, prompt revision and full source content in ignored `.cache/`.
Interrupted runs reuse checked cached results; failed results are not cached. This bounds repeated API spend.
The same directory saves the exact source rows and an audit of failed records and unique prize classifications.
Keep it private and local; only the validated public artifact and agent review are committed.
`--check` validates the saved artifact against current source rows without making a Gemini request.
The final summary reports per-domain/status counts, prize kinds, failures and actual provider calls.

Before shipping, follow the source-sampling and complete distinct-prize review in the feature spec.
`python corpus/classify/review.py` prepares deterministic samples with complete source text and artifact hashes
in the ignored cache. It assigns no review verdict; an agent must compare source and classification.
Missing evidence remains unknown; a prize classification is not an estimate of winning likelihood.

## Label store and agent labelling

`--labels corpus/classify/labels` keeps every checked label per project (id plus a hash of title, tagline,
description and technologies) and per prize string, with the model that produced it. A row already in the store is
re-validated against today's text and never sent again; a changed description is labelled afresh. The published
8,409 Gemini labels are seeded with `--seed-from public/classify/classes.json --from-jsonl <the rows they came from>`.

`--provider agent --answers DIR` replaces the API with classification agents: each unanswered batch's exact prompt
is written to `DIR/prompts/<digest>.txt`, an agent writes `DIR/answers/<digest>.json`, and `--check-answer` runs the
same validators on it. `--labels-only --from-jsonl rows.jsonl` labels a corpus that has no star manifest yet (the
growth fetch). An agent run that still has unanswered batches withholds `classes.json` instead of publishing
`insufficient_text` for them. `classes.json`'s `model` names every model whose labels it contains.

## Jev trial provider

Set `OPENROUTER_API_KEY` in your environment, then use a separate label directory for trials:

```sh
python corpus/classify/run.py --provider jev --labels-only --from-jsonl records.jsonl \
  --labels /tmp/jev-trial-labels --cache /tmp/jev-trial-cache --concurrency 4
```

This calls OpenRouter Decisions with `typesafe/jev-1.13`. Questions select fixed choices and exact source
passages; the existing validators check the translated labels. Conflicting answers remain pending, return a
nonzero exit, and withhold public artifacts. Completed labels and raw answers are cached for resumption.
Inspect `jev/pending.json`, `jev/usage.json` and `jev/responses/` inside the selected cache directory.
Keep that cache local: it contains source passages. Credential, quota and configuration failures stop the run.

The 500-project pilot produced 470 validated labels and 30 pending projects. Bulk use is parked; see
`specs/decisions/corpus-classify-jev-trial.md`. Schema validation alone does not establish semantic accuracy.
