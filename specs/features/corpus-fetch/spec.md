---
name: Fetch, clean and dedupe real past hackathon projects with provenance
depends_on: [bootstrap]
owns: [corpus/fetch/, corpus/fixtures/]
assignee: ""
---

# Corpus fetch

## Plan
1. `corpus/fetch/` script (own `requirements.txt`): start from a committed list of past hackathon gallery URLs
   on Devpost; walk each gallery's pages, then each project page.
2. Parse each project; write one JSON line per project to `corpus/data/projects.jsonl` (gitignored), with a
   checkpoint so a rerun resumes.
3. Commit `corpus/fixtures/sample.jsonl`: up to 100 real records the run produced.

## Requirements
- Record fields: `id` (sha1 of canonical URL), `url`, `title`, `tagline`, `description`, `technologies[]`,
  `events[]` (name + gallery URL), `date` and `date_kind` (`submission` or `unknown`), `source`, `fetched_at`,
  `content_hash`. A field the page doesn't have stays null; never fill one in.
- Reject a record with no URL, title or description; count rejections by reason.
- One project in several events is one record with several `events`.
- At most 1 request per second. Stop a source on 403/429 or a repeated page. One retry per request.
- Print counts: discovered, fetched, parsed, rejected (by reason), deduplicated, written.

## Validation
1. `python corpus/fetch/run.py --limit 50` -> the count line prints and `corpus/data/projects.jsonl` has the
   written count.
2. Open 3 random records' `url`s -> each page matches its title.
3. `pytest corpus/fetch` -> parser tests against saved real HTML in `corpus/fetch/testdata/`, the dedupe test
   and the rejection tests pass. Keep: the count line.

## Defaults
Check robots.txt per host before fetching; robots.txt on devpost.com allowed `*` on 2026-10-10. Pick galleries of large, recent events first. A full run is operations, not a PR: merge once the script works on a limited run.
