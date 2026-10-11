## What shipped
`corpus/fetch/merge.py --include-summary-only` writes each gallery card with no full record as a summary-only record in the full shape (`description: ""`, `technologies: []`, `date_kind: "unknown"`, `detail: "summary"`), so embed, release and the NOT NULL schema load it unchanged. A full record always wins; without the flag the output is byte-for-byte main's.
**Measured on the real snapshot (Sun 00:00): only 69 summary-only projects** among 40,691 full records and 43,345 cards. The full fetch requests every project on every gallery page it reads, so cards rarely lack a full record. Volume only comes from a `--gallery-only` pass over galleries the full fetch hasn't reached.
## Where it lives
`corpus/fetch/merge.py`, `corpus/summaries/` (tests, requirements.txt)
## How to check it
verify: `node scripts/verify.mjs corpus-summaries …/agent-evidence/corpus-summaries/20261011T042940Z` pass. 7 tests in `corpus/summaries/`, 6 failing on origin/main (the 7th pins the unchanged no-flag output against main's own merge.py).
Real run: merge 40,691 + 43,345 cards in 49 s -> `summary_only_written: 69`. Embed 1,000 (69 summary + 931 full) in 119 s (8.4/s), UMAP 108 s (mostly first-call compile), load()'s SQL on TEST_DATABASE_URL 31 s then rolled back (1,000 rows, 69 with `description = ''`; 8,409 rows before and after), `corpus/release/check.py` validate passes on the written stars and rows.
## Gaps
- Classification of summary records wasn't timed (needs a provider run); corpus-classify allows a null/empty description and should label most as `insufficient_text`.
- The load was rolled back, not committed: the test database is shared by other features' e2e suites. Publishing waits for summary-records-api and -ui (spec).
