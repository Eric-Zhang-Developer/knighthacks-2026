## What shipped
`corpus/fetch/run.py`: `discover` adds ended hackathons from Devpost's API to `sources.jsonl` (16 Knight Hacks galleries seeded); `fetch` walks galleries and project pages at 1 req/s into `corpus/data/projects.jsonl` with provenance, dedupe, rejection counts and resume. Since #310: 2 req/s with one 429 backoff to 1 req/s, and every gallery card (title, tagline, winner badge) captured to `corpus/data/summaries.jsonl`; `fetch --gallery-only` collects ~24 projects per request. 100 real records committed as `corpus/fixtures/sample.jsonl`.
## Where it lives
`corpus/fetch/` (run.py, parse.py, test_fetch.py, testdata/, sources.jsonl, requirements.txt), `corpus/fixtures/sample.jsonl`
## How to check it
verify: `node scripts/verify.mjs corpus-fetch /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/corpus-fetch/20261010T100020Z` pass at 2c8dfe0 (uncommitted changes) (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/corpus-fetch/20261010T100020Z)
Live run: `fetch --limit 100` -> `discovered 101, fetched 100, parsed 100, deduplicated 0, written 100, rejected 0`; 3 random records' titles matched their live pages.
Gallery capture and rate: `verify.py --slug corpus-fetch` pass (20 tests: card parser on saved real HTML, summaries and resume, gallery-only skips project pages and counts --limit per card, 2/s pacing, 429 backoff incl. HTTP-date Retry-After, no request after the deadline, second 429 and 403 stop, `--rps` ceiling, and corpus/release's own parser still reads the stop line).
## Gaps
- The full corpus run hasn't happened yet: it's operations, not this PR. Size unknown until it runs.
- Event `dates` are known only for galleries in `sources.jsonl`; other events a project lists stay null.
- Summary records (gallery cards) aren't embedded, published or shown yet: no downstream feature reads `summaries.jsonl`. The 2 req/s rate and gallery-only mode are tested against fakes and saved real HTML only; the live check waits for the running #262 fetch, so we never run two fetchers against Devpost at once.
- Devpost's CDN rejects urllib's default headers; the fetcher sends a crawler UA plus `Accept: */*` (what curl sends). If Devpost blocks that too, the run stops by design.
