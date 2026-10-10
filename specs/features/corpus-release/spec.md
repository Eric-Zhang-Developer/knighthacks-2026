---
name: Publish the full real corpus to production with a validated bundle
depends_on: [corpus-embed, galaxy]
owns: [corpus/release/]
assignee: ""
---

# Corpus release

corpus-fetch merges once its script works on a limited run, and corpus-embed is validated on the fixture. Nothing
yet runs the full corpus into production. Without this, the safe demo shows at most the 100-record fixture.

## Plan
1. `corpus/release/run.py`: full `corpus/fetch` run (resumes from its checkpoint), then `corpus/embed` against the
   production `DATABASE_URL`, writing `public/corpus/stars.json`.
2. `corpus/release/check.py` validates the bundle before it ships: `stars.json` `count` equals
   `select count(*) from projects`; one `corpus_version` across both; every row has a `url`; no duplicate `id`.
3. Print one count line: discovered, fetched, parsed, rejected (by reason), deduplicated, indexed, displayed.
4. Commit the checked `stars.json` in a `fix(corpus-embed): publish corpus <corpus_version>` PR (corpus-embed owns
   `public/corpus/`).

## Requirements
- `check.py` failing means nothing is committed or announced.
- No count is promised (decision D2); the UI and the done note show the real count line.
- Needs the production Neon URL (#11). Without it, file nothing new: note it on #11 and stop.

## Validation
1. `pytest corpus/release` -> `check.py` rejects a bundle with a count mismatch, a missing `url` and a split
   `corpus_version` (small real fixture rows, broken on purpose in the test).
2. Run it -> the count line prints and `check.py` passes. Keep the count line and the `corpus_version`.
3. Open `/` on the merged commit -> the galaxy shows that count.

## Defaults
If a source stops the run (403/429), release what passed validation and list the stopped source in Gaps.

## Publication decision (2026-10-10)
The user reopened publication after the idea-create-api freeze. Production preflight found no saved-idea table;
the 8,409-record checkpoint may use the existing full UMAP projection. Recheck production immediately before
loading: if saved idea versions now exist, stop publication and record the changed evidence in #63. Never delete
or rewrite saved ideas. Validate the same prepared records on TEST_DATABASE_URL first, retain the prior database
and bundle for rollback, publish the matching bundle through fix(corpus-embed), then freeze this corpus again.
