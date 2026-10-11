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
   checkpoint so a rerun resumes. The checkpoint covers gallery pages too: once every project on a gallery page is
   written or rejected, a line in `corpus/data/progress.jsonl` records it, and a rerun starts each source after its
   last handled page, and skips a source that ended on a short page followed by an empty one (a lone empty reply
   may be transient, so it's asked again). A page cut short by a stop, the deadline or `--limit` is redone, and so is
   every page after it in that source: progress stays contiguous.
   Gallery-only progress never lets a full run skip a page's projects. `--rewalk` ignores the file.
3. Commit `corpus/fixtures/sample.jsonl`: up to 100 real records the run produced.

## Requirements
- Record fields: `id` (sha1 of canonical URL), `url`, `title`, `tagline`, `description`, `technologies[]`,
  `events[]` (name, URL, `dates` from the hackathon API or null, `prizes` won), `date` and `date_kind` (`created`,
  the page's "started this project" time, or `unknown`: Devpost shows no submission time), `source`, `fetched_at`,
  `content_hash`. A field the page doesn't have stays null; never fill one in.
- Reject a record with no URL, title or description; count rejections by reason.
- One project in several events is one record with several `events`.
- Parallel machines use explicitly assigned `--sources` manifests and exclusive `--data-dir` directories.
  `--exclude-projects` accepts stable JSONL checkpoints containing known project URLs or SHA-1 IDs (repeatable); skipped
  project details still retain gallery observations. No two writers share a data directory.
  `corpus/fetch/merge.py` combines stopped/snapshotted project files into a separate output, validates canonical
  URL/ID and content hashes, chooses the newest project text, and retains event memberships, known dates, prizes,
  and source observations. Optional `--summaries` preserves memberships found when a detail fetch was skipped.
  Summary-only records stay separate: no description is invented. One release owner publishes the combined data.
- At most `--rps` requests per second: default 2, ceiling 8 (raised from 1, then 2, then 5, on 2026-10-10, person's call:
  Devpost publishes no limit and robots.txt sets no crawl delay). `--workers` (1–8, default 1) keeps that many project
  pages in flight, because one page takes ~1 s and a single request in flight caps the rate at ~1/s; pacing and the
  backoff are shared by every worker, and records are written in gallery order. The first 429 waits `Retry-After` (else 60 s, at most 300 s) and drops to 1 per
  second for the rest of the run; a second 429 (one sent after the backoff began) or any 403 stops the run. Stop a source on a repeated page. One retry
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
4. The parallel-collector tests prove isolated resume and known-project exclusion; merge tests prove idempotent
   unique records, retained source/event observations, and refusal of invalid input without overwriting output.

## Defaults
Check robots.txt per host before fetching; robots.txt on devpost.com allowed `*` on 2026-10-10. Pick galleries of large, recent events first. A full run is operations, not a PR: merge once the script works on a limited run.
