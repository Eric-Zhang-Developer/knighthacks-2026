---
name: An unlisted build-status page that shows people and judges how the agent-built project is going
depends_on: []
owns: [app/foreman/, components/foreman/, lib/foreman/, tests/foreman/, tests/e2e/foreman/]
assignee: "foreman"
---

# Foreman: the site office

The project is built by several agents at once, faster than the two people on the team can follow. `status.py`
already works out the state, but as a Markdown issue nobody reads mid-event. Foreman is one unlisted page,
`/foreman`, styled as a construction terminal, that answers four questions in order:
1. **Will we make it?** Each milestone's ship and freeze countdown, and its features done of total.
2. **What needs a person right now?** `plan:`/`contract:` PRs waiting for a human merge, `needs-human` and
   `blocked` issues, stale draft PRs, done notes whose gaps or "not verified" lines need a look, main CI red.
3. **How does it fit together?** Every feature as a node in its `depends_on` graph, coloured by state, glowing by
   recent activity, labelled with the worker holding it.
4. **How did we get here?** (judges) A replay that scrubs through merged PRs and lights features up as they landed.

Person's decisions (2026-10-10): construction-terminal look, unlisted and open (no key), understanding views
before the replay, tuned for a live laptop walkthrough. Owned entirely by worker `foreman`; it's in `allow`, not in
any milestone's `features`, so other agents never pick it.

## Plan
1. `lib/foreman/`: read `origin/main` and GitHub live (raw files for specs, `changes/`, `milestones.toml`; the REST
   API for PRs, issues and check runs), then a pure model that turns that into the board. Port the rules from
   `.agents/scripts/status.py`, don't invent new ones.
2. `app/foreman/page.tsx` + `components/foreman/`: countdown strip, needs-a-person list, feature graph (SVG), PR
   lanes.
3. Heat on the graph, then the replay.

## Requirements
- A feature's state uses AGENTS.md's definitions: **done** = `changes/<slug>.md` on main; **in flight** = an open PR
  titled `feat(<slug>): ...`; **ready** = every `depends_on` done and not in flight; **blocked** otherwise; **cut**
  = on a milestone's `cut` list; **backlog** = in no milestone's `features`.
- Verified/not verified and gaps follow `status.py`: verified only when `## How to check it` has a passing
  `verify: ... pass` line and no failing or "not verified" line; gaps = the first line of `## Gaps` unless it says
  none.
- Every number on the page comes from the repo or GitHub at request time. Unknown shows as unknown (for example
  GitHub unreachable or rate-limited), never a guess or a stale number dressed as live.
- `GITHUB_TOKEN` (optional, server-only, read-only) raises the API limit; it never reaches the browser. Without it
  the page still works within GitHub's unauthenticated limit.
- The page is `noindex` and linked from nowhere in the product. It adds no database tables and changes no product
  code, so it can't break the demo.
- Data is cached for about a minute; the page says how old it is.

## Validation
1. `pnpm build && pnpm start`, open `/foreman` -> the countdown strip shows each milestone from `milestones.toml`
   with done/total counts matching `changes/` on main.
2. The graph shows one node per spec in `specs/features/` (minus `_template`), each in the state `status.py --out -`
   gives it at the same moment (done, in flight, ready, blocked).
3. The needs-a-person list includes every open `plan:`/`contract:` PR that isn't a draft and every open
   `needs-human` issue, each linking to GitHub.
4. With GitHub unreachable, the page renders and says the data is unavailable, rather than erroring.
5. `tests/foreman/` (vitest) pins the state rules on fixed inputs; `tests/e2e/foreman/` loads the page against live
   GitHub and checks 1–3. Keep a full-page screenshot.

## Defaults
Cache: 60 s. Stale draft: 45 min without a push (the watchdog's number). If the spec is silent, show less and keep
it truthful.
