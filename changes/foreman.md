## What shipped
`/foreman`, an unlisted (noindex) build-status page: milestone countdowns with per-feature cells, what each has left and a pace forecast, "needs a person" (plan/contract PRs to merge, duplicate feature claims, stale drafts, needs-human issues, red main), stats, the feature dependency graph with state, build time, missed features, heat, critical path, hover tracing and a click-to-open feature card, open PRs by worker, and demo keys (1–5 jump to sections, space plays the replay), a "since you last looked" banner, and a replay that scrubs the graph from the first PR to now (states rebuilt from PR history). Reads main and GitHub live, using status.py's rules.

## Where it lives
`app/foreman/page.tsx`, `components/foreman/`, `lib/foreman/` (`github.ts` reads, `board.ts` + `parse.ts` model), `tests/foreman/`, `tests/e2e/foreman/`.

## How to check it
- verify: `node scripts/verify.mjs foreman /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/foreman/20261010T151547Z` pass at dcd8295

## Gaps
- The replay rebuilds states from PR history on today's plan: features whose spec didn't exist yet show as ready/blocked rather than absent, and cut/backlog are today's lists.
- Not yet seen on the Vercel deploy; it needs `GITHUB_TOKEN` there (set by the person 2026-10-10). Unauthenticated mode (60 calls/hour, 10-minute cache) is untested live.
- Heat is lines changed in the last 3h, falling back to PR activity (labelled) when a count is missing. Workers come from `Worker:` in PR bodies; PRs without one show as `unnamed`.
- The page is cached and regenerated at most once a minute (stale-while-revalidate): the first view after a quiet spell can be old, shown in the header, and refreshes itself 5 s later.
