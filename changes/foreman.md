## What shipped
`/foreman`, an unlisted (noindex) build-status page, now a **static snapshot taken once per build** (spec § Architecture): repo files from the checkout, one bounded GitHub API pass with `GITHUB_TOKEN` (13 calls on 2026-10-10), zero GitHub calls per view. It opens on **the judge tour** (spec § The tour): the dependency graph and its replay, with big counters for the scrubbed moment (features built, PRs merged, agents at work), a 3-line merge ticker, chapters computed from the snapshot (first PR, milestones built, peak PRs open at once) and a flash as each feature lands; space plays it in about 24 s. Then milestone countdowns with per-feature cells, what's left and a pace forecast; a build-up chart of features built toward the final freeze, with the pace line to when all land; "needs a person" (plan/contract PRs to merge, duplicate claims, cut features still in pick order, stale drafts, needs-human issues, red main); stats; the graph's state, heat, critical path, hover tracing and feature card (spec, PR and done-note links); a crew timeline of every PR per worker (sub-rows for overlaps, a strip of PRs open at once); open PRs by worker; demo keys; a "since you last looked" banner. The header stamps the snapshot time, commit and API status; without PR data the board still renders from files, with a banner and `unknown` states.

## Where it lives
`app/foreman/page.tsx`, `components/foreman/`, `lib/foreman/` (`collect.ts` takes the snapshot, `board.ts` + `parse.ts` model it, `charts.ts` chart series, `time.ts` clocks), `tests/foreman/` (`production.test.ts` checks the live deploy), `tests/e2e/foreman/`.

## How to check it
- verify: `node scripts/verify.mjs foreman /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/foreman/20261010T214218Z` pass at 9fc0205 (with `GITHUB_TOKEN`: 9/9, the tour's playback, chapter caption, flash, end counters and reduced motion included)
- verify: `node scripts/verify.mjs foreman /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/foreman/20261010T214345Z` pass at 9fc0205 (no token, the CI path: 3 passed, 6 PR-data tests skipped)
- Live (Validation 5): `production.test.ts` passed on `1b02864` and again on `7b5605d` after the next merge: one snapshot per deploy (#194).

## Gaps
- Fresh as of the last deploy: a PR opened after the last merge to main appears with the next deploy. The header shows the snapshot's age (amber past 30 min). A scheduled redeploy needs a Vercel deploy hook from a person.
- GitHub's rate limit is per account: the build shares 5,000 calls/hour with every agent on the same login (2,166 left at 13:22). A build that finds it empty renders from files with the PR-data banner.
- Agents at work counts named workers (`Worker:` in the PR body) with a PR open; unnamed PRs count in "PRs open at once" but not there.
- Chart palette checked for colour vision (worst CVD ΔE 12.0, dark only: the page has no light mode).
- The replay rebuilds states from PR history on today's plan: features whose spec didn't exist yet show as ready/blocked rather than absent, and cut/backlog are today's lists.
- Workers come from `Worker:` in PR bodies; PRs without one show as `unnamed`. CI dots cover the 25 newest open PRs.
