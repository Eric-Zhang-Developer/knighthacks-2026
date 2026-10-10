## What shipped
`/foreman`, an unlisted (noindex) build-status page, now a **static snapshot taken once per build** (spec § Architecture): repo files from the checkout, one bounded GitHub API pass with `GITHUB_TOKEN` (13 calls on 2026-10-10), zero GitHub calls per view. Milestone countdowns with per-feature cells, what's left and a pace forecast; "needs a person" (plan/contract PRs to merge, duplicate claims, cut features still in pick order, stale drafts, needs-human issues, red main); stats; the dependency graph with state, heat, critical path, hover tracing and a feature card; the replay from the first PR to the snapshot; open PRs by worker; demo keys; a "since you last looked" banner. The header stamps the snapshot time, commit and API status; without PR data the board still renders from files, with a banner and `unknown` states.

## Where it lives
`app/foreman/page.tsx`, `components/foreman/`, `lib/foreman/` (`collect.ts` takes the snapshot, `board.ts` + `parse.ts` model it, `time.ts` clocks), `tests/foreman/` (`production.test.ts` checks the live deploy), `tests/e2e/foreman/`.

## How to check it
- verify: `node scripts/verify.mjs foreman /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/foreman/20261010T165718Z` pass at b281dbc (with `GITHUB_TOKEN`: 6/6)
- verify: `node scripts/verify.mjs foreman /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/foreman/20261010T165608Z` pass at b281dbc (no token, the CI path: 3 passed, 3 PR-data tests skipped)
- Build: `○ /foreman` static, no `api.github.com` entry in `.next/cache/fetch-cache`, no token pattern in the HTML.

## Gaps
- Fresh as of the last deploy: a PR opened after the last merge to main appears with the next deploy. The header shows the snapshot's age (amber past 30 min). A scheduled redeploy needs a Vercel deploy hook from a person.
- Validation 4 (the live deploy) runs after this merges; its result goes on #194. Before this change it failed on production: no `API: token` stamp.
- The replay rebuilds states from PR history on today's plan: features whose spec didn't exist yet show as ready/blocked rather than absent, and cut/backlog are today's lists.
- Workers come from `Worker:` in PR bodies; PRs without one show as `unnamed`. CI dots cover the 25 newest open PRs.
