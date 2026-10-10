## What shipped
`public/classify/classes.json` for corpus `2026-10-10-8409`, labelled by Gemini (`gemini-3.8-flash`, inferred): all 8,409 projects and all 263 distinct prize strings, with 0 fallbacks. 66 are `insufficient_text`, 395 are `mixed`, and the largest domain is productivity at 19.3%. The agent review found 1 incorrect, 12 ambiguous and 99 correct domains among 112 sampled projects, and 1 incorrect, 32 ambiguous and 230 correct among the 263 prize strings.
## Where it lives
`corpus/classify/run.py`, `corpus/classify/review.py`, `public/classify/classes.json`, `specs/decisions/corpus-classify-review.md`, `tests/corpus-classify/`.
## How to check it
verify: `node scripts/verify.mjs corpus-classify /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/corpus-classify/20261010T232716Z` pass at 41a14d5; `run.py --check` printed "verified 8409 records, version 2026-10-10-8409". Typecheck, lint and 392 app tests passed (2 skipped).
## Gaps
- The corpus growth release (#262) will change `corpus_version` and the project ids. Classification has to be re-run on the new version before that release reaches production; otherwise the galaxy refuses this file ("classes.json is for another corpus"). The cache is keyed per 25-record batch, so a new version reuses little of it.
- This review is agent-reviewed only; nobody has checked these labels by hand.
- The taxonomy has no media or creative domain, so film tools are split across games, productivity and commerce.
- A coding assistant that appears only in the tech tags stays `unknown`.
- Places such as "Winner" or "First Runner-Up" that the prize text implies but doesn't state stay null.
