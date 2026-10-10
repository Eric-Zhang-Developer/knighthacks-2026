# Offline corpus classification

Run from the repository root with Python 3.11. Install the existing database dependency pinned in
`corpus/embed/requirements.txt` (`psycopg[binary]==3.2.12`); Gemini uses only the standard library.
Provide `DATABASE_URL`, `GEMINI_API_KEY` and `GEMINI_MODEL` through your local environment, never CLI arguments.

```sh
python corpus/classify/run.py
python corpus/classify/run.py --check
python -m pytest tests/corpus-classify
```

The database connection is read-only and selects the exact version in `public/corpus/stars.json`.
Alternatively, `--from-jsonl records.jsonl` accepts complete source rows, including `corpus_version`.
`--stars` and `--output` allow isolated fixtures. Each source ID must match the star manifest exactly.
The default output is `public/classify/classes.json`. Its categories are **inferred**, never verified facts.

Batches contain at most25 full descriptions, with at most4 concurrent calls (both configurable downward).
Each returned index must occur exactly once; response ordering cannot silently swap project labels.
Invalid results retry once, then become unknown. Authentication/model/request-configuration failures abort
after one retry. A first batch runs before the rest to detect configuration problems cheaply.
The saved artifact contains no prompt, source description, source URL, credential or database connection string;
reported development-tool use includes only a checked verbatim evidence quote from the source description.
Product integrations with AI models do not establish coding-assistant use.

Successful batches are cached by model, prompt revision and full source content in ignored `.cache/`.
Interrupted runs reuse checked cached results; failed results are not cached. This bounds repeated API spend.
The same directory saves the exact source rows and an audit of failed records and unique prize classifications.
Keep it private and local; only the validated public artifact and agent review are committed.
`--check` validates the saved artifact against current source rows without making a Gemini request.
The final summary reports per-domain/status counts, prize kinds, failures and actual provider calls.

Before shipping, follow the source-sampling and complete distinct-prize review in the feature spec.
Missing evidence remains unknown; a prize classification is not an estimate of winning likelihood.
