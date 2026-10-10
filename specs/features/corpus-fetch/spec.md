---
name: Fetch, clean and dedupe real past hackathon projects with provenance
depends_on: [bootstrap]
owns: [corpus/fetch/, corpus/fixtures/]
assignee: ""
---

# Corpus fetch

## Plan
1. `corpus/fetch/` script (own `requirements.txt`): `run.py discover` adds ended hackathons from Devpost's hackathon
   API to the committed `sources.jsonl`; `run.py fetch` walks each gallery's pages, then each project page.
2. Parse each project; write one JSON line per project to `corpus/data/projects.jsonl` (gitignored), with a
   checkpoint so a rerun resumes.
3. Commit `corpus/fixtures/sample.jsonl`: up to 100 real records the run produced.

## Requirements
- Record fields: `id` (sha1 of canonical URL), `url`, `title`, `tagline`, `description`, `technologies[]`,
  `events[]` (name, URL, `dates` from the hackathon API or null, `prizes` won), `date` and `date_kind` (`created`,
  the page's "started this project" time, or `unknown`: Devpost shows no submission time), `source`, `fetched_at`,
  `content_hash`. A field the page doesn't have stays null; never fill one in.
- Reject a record with no URL, title or description; count rejections by reason.
- One project in several events is one record with several `events`.
- At most 2 requests per second (`--rps`; raised from 1 on 2026-10-10, person's call: Devpost publishes no limit and
  robots.txt sets no crawl delay). The first 429 waits `Retry-After` (else 60 s, at most 300 s) and drops to 1 per
  second for the rest of the run; a second 429 or any 403 stops the run. Stop a source on a repeated page. One retry
  per request.
- Every gallery page's cards go to `corpus/data/summaries.jsonl` at no extra request: one line per project per event
  with `id`, `url`, `title`, `tagline`, `event` (name, URL, dates, `winner` badge), `detail: "summary"`, `source`,
  `fetched_at`, `content_hash`. No description: it exists only on the project page. `fetch --gallery-only` writes
  only these (~24 projects per request) and skips project pages.
- Print counts: discovered, fetched, parsed, rejected (by reason), deduplicated, written, summarized, and the rate.

## Validation
1. `python corpus/fetch/run.py fetch --limit 50` -> the count line prints and `corpus/data/projects.jsonl` has the
   written count.
2. Open 3 random records' `url`s -> each page matches its title.
3. `pytest corpus/fetch` -> parser tests against saved real HTML in `corpus/fetch/testdata/`, the dedupe test
   and the rejection tests pass. Keep: the count line.

## Defaults
Check robots.txt per host before fetching; robots.txt on devpost.com allowed `*` on 2026-10-10. Pick galleries of large, recent events first. A full run is operations, not a PR: merge once the script works on a limited run.
