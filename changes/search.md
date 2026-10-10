## What shipped
Search returns exact cosine-ranked neighbors plus title matches; the shared neighbor query now preserves recall across the released 8,409-record corpus. Existing search bar, fallback and event/year filtering remain covered.
## Where it lives
`app/api/search/route.ts`, `lib/search/`, `components/search/`, `tests/search/`, `tests/e2e/search/`; ranking rationale and timings: `specs/decisions/search-exact-ranking.md`.
## How to check it
verify: `node scripts/verify.mjs search /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/search/20261010T192430Z` pass at ac20c5c (uncommitted changes) (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/search/20261010T192430Z)
## Gaps
Four live test-branch checks pass, including all three title goldens, selection/clear, fallback and filters. Screenshot/JSON retained; actual galaxy highlight pixels and concurrent load are not asserted. Exact scans cost about 62 ms on this corpus and need remeasurement if it grows; no production-data or layout changes.
