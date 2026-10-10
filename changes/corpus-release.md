## What shipped
The approved 8,409-record checkpoint was validated on test Neon, published to production as `2026-10-10-8409`, and deployed through #191 (21f98bf). This release invocation discovered/fetched/parsed/rejected/deduplicated 0; indexed/displayed 8409; fetch stopped at its deadline.
## Where it lives
`corpus/release/run.py`, `corpus/release/check.py`, `public/corpus/stars.json`; publication decision in `specs/decisions/corpus-release-reopened-publication.md` and receipts in #63.
## How to check it
verify: `node scripts/verify.mjs corpus-release /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/corpus-release/20261010T173832Z` pass at f97c64a. The production count/version/source gate and five golden queries passed; the deployed galaxy showed 8409, exact bundle SHA256 matched, and verify_release.py passed at 2026-10-10T17:39:42Z.
## Gaps
Historical fetch totals and provider cost are unknown. HNSW recall failed on the first full test load; #191 rebuilds its index, and unchanged golden checks then passed. Rollback and actual receipts are preserved locally. Browser-verified, not yet tried by a person in this run; corpus frozen after this one publication.
