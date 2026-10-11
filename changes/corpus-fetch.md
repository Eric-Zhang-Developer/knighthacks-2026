## What shipped
Resumable Devpost discovery/fetch with source links, gallery summaries, shared pacing/backoff (default 2, ceiling 8 requests/s; up to 8 workers), isolated source/output paths and known-project URL/ID exclusions. A validated atomic merge keeps one project per canonical URL and preserves event/source observations.
Future detail-page ingestion excludes gallery chrome from descriptions and renders the two observed question-mark shortcodes while preserving headings and unknown source text.
## Where it lives
`corpus/fetch/` (`run.py`, `parse.py`, `merge.py`, `PARALLEL.md`, tests and real saved HTML); `corpus/fixtures/sample.jsonl`; `specs/decisions/corpus-fetch-parallel.md`.
## How to check it
verify: `node scripts/verify.mjs corpus-fetch "C:\Users\kirol\OneDrive\Desktop\Knighthack\.git\agent-evidence\corpus-fetch\20261011T004144Z"` pass at 02edc42 (uncommitted changes). 40 corpus tests, 14 release tests, typecheck/lint and 398 app tests pass (2 app tests skipped). Live Windows run: discovered/fetched/parsed/written 50, rejected 0; 50 unique IDs, no overlap with 8,409 published IDs; 3 random source-page titles matched live.
Parser regression: `node scripts/verify.mjs corpus-fetch "C:\Users\kirol\OneDrive\Desktop\Knighthack\.git\agent-evidence\corpus-fetch\20261011T123148Z"` pass at e28f632 (uncommitted changes); 41 tests include injected issue markers in the saved real HTML fixture.
## Gaps
Cross-machine HTTP requests are not exactly-once: event manifests and exported skip lists reduce overlap; canonical merge enforces final dataset uniqueness. Merge only stable snapshots. Historical observations remain in the retained JSONL, while existing database fields retain project/event links. Summary-only records are not embedded or published. Unknown event dates remain null; first resume on an old checkpoint still re-walks once. Full growth, Mac handoff and combined database/bundle publication are separate ongoing operations (#262); this PR performs no database replacement.
Already-loaded descriptions are unchanged; repairing or reloading them remains a separate follow-up before #467 is closed.
