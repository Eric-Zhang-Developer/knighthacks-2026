---
name: Publish gallery-card projects as summary-only stars, toward the 100k corpus goal
depends_on: [corpus-fetch, corpus-embed]
owns: [corpus/fetch/merge.py, corpus/fetch/test_merge.py, tests/corpus-summaries/]
assignee: ""
---

# Summary-only records

Mac (the corpus data lives there). Traces to the roadmap's corpus goal (person, Sat 18:10; #317): every gallery
card in `corpus/data/summaries.jsonl` (#310) becomes a star, with a full record wherever we have one. Embedding
now keeps up (#363 measured up to 8.5 records/s), which #317 named as the condition for these specs.

## Plan
1. `merge.py` gains `--include-summary-only`. Without it, output is byte-for-byte what it is today.
2. With it, every summary card whose canonical URL has no full record becomes one record in the full shape, so
   `corpus/embed/run.py` and `corpus/release` load it unchanged:
   `{id: sha1(url), url, title, tagline, description: "", technologies: [], events: [...], date: null,
   date_kind: "unknown", source: "devpost", fetched_at, content_hash, detail: "summary"}`.
   - `events`: one entry per distinct event the project's cards came from, `{name, url, dates, prizes: []}`, plus
     `winner: true` only when that card showed the winner badge. No prize text is inferred from the badge.
   - `content_hash` stays the card's own (sha256 of `title\ntagline`), so embedding caches it apart from full text.
   - `fetched_at` is the newest of its cards.
3. A full record always wins: a URL with both keeps the full record (today's behaviour, observations included).
4. The printed `merge: {...}` result adds `"summary_only_written": N`; the existing keys stay.

## Requirements
- An empty `description` is how the app knows a record is summary-only (full records always have one, `merge.py`
  rejects them otherwise). Never fill it with the tagline or anything generated.
- Title and tagline are copied exactly. No record is invented for a card without a title or a valid project URL.
- Ids stay `sha1(canonical url)`, the same id a later full fetch of that project would get.

## Validation
1. Unit tests (`corpus/fetch/test_merge.py`, `tests/corpus-summaries/`), each failing on origin/main first:
   a card with no full record -> one summary record with `description ""` and the shape above; the same URL in two
   events -> one record, two events; a URL with a full record -> the full record only; the badge -> `winner: true`
   and `prizes: []`; without the flag the output is identical to today's.
2. On a real snapshot: `merge.py ... --summaries <summaries.jsonl> --include-summary-only` -> keep the printed
   counts. Then `corpus/embed/run.py --input <merged>` against a test database (never production) -> keep the row
   count, a sample summary row (`description = ''`) and its star in the written `stars.json`.
3. `corpus/release/check.py` passes on that output (star count equals row count, ids match).

## Defaults
- Publishing is the growth release's step (#262), not this PR's: this PR ships the code and the test-database run.
