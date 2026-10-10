---
name: An unlisted build-status page, built once per deploy from the repo and GitHub, that shows the team and judges how the agent-built project is going
depends_on: []
owns: [app/foreman/, components/foreman/, lib/foreman/, tests/foreman/, tests/e2e/foreman/]
assignee: "foreman"
---

# Foreman: the site office

The project is built by several agents at once, faster than the two people on the team can follow. `status.py`
already works out the state, but as a Markdown issue nobody reads mid-event. Foreman is one unlisted page,
`/foreman`, styled as a construction terminal, that answers four questions in order:
1. **Will we make it?** Each milestone's ship and freeze countdown, and its features done of total.
2. **What needs a person?** `plan:`/`contract:` PRs waiting for a human merge, `needs-human` and `blocked` issues,
   duplicate claims, stale draft PRs, cut features still in pick order, done notes whose gaps or "not verified"
   lines need a look, main CI red.
3. **How does it fit together?** Every feature as a node in its `depends_on` graph, coloured by state, glowing by
   recent activity, labelled with the worker holding it.
4. **How did we get here?** (judges) A replay that scrubs through merged PRs and lights features up as they landed.

Two audiences, one page. **The team** opens it to see what needs them; it must say how old its data is. **Judges**
see it in a live laptop walkthrough; it must load instantly and can never show an error page.

Person's decisions (2026-10-10): construction-terminal look, unlisted and open (no key), tuned for a live laptop
walkthrough, and **collect the data once, then show it** (after the
request-time version hit GitHub's rate limit and went blank in production). Owned entirely by worker `foreman`;
it's in `allow`, not in any milestone's `features`, so other agents never pick it. Implementation plan:
[plan.md](plan.md).

Later the same day the person approved a **40-second judge tour** (it replaces "understanding views before the
replay"): the replay leads the page, because it is the one view a judge grasps without explanation, and the
rubric's Technical Understanding asks for "diagrams in the demo" (`specs/context/event.md`). The team sections
follow it unchanged. The tour, in the walkthrough:
1. (5 s) "We wrote specs; a crew of agents built it under one rulebook. Here's the actual build."
2. (25 s) Space: the graph fills in, nodes flash as features land, counters climb, chapters caption the moments.
3. (10 s) Click one node: its spec, its PR and its done note, on GitHub. Every node is real.

## Architecture
```
next build (every deploy; every merge to main deploys)
  1. repo files   <- the checkout on disk: specs/**/spec.md, changes/*.md, specs/milestones.toml, STOP
  2. GitHub API   <- one pass, only if GITHUB_TOKEN is set: PRs, open issues, main's last CI run, open PRs' CI
  3. buildBoard(raw, snapshotTime)   pure; status.py's rules
  4. static HTML  <- /foreman is prerendered once; the snapshot is baked into the page
page view: zero server work, zero GitHub calls. Client code only ticks clocks and runs the replay.
```
- **A snapshot, not a feed.** The data is read once per build and frozen into static HTML. Nothing reads GitHub
  when someone opens the page, so no number of viewers can hit a rate limit, and the page works with GitHub down.
- **Repo files come from disk**, from the commit being built, so the board and the build are always the same commit.
  No API call is needed for them.
- **The API is optional and bounded.** It runs only with `GITHUB_TOKEN` set (read-only, server-only, set in Vercel
  for builds). With no token it makes no calls (CI, local tests). One render makes at most `2 + PR pages + 25`
  calls (about 12 today). GitHub responses are never written to Next's data cache: Vercel restores that cache
  between builds, and a cached response would freeze the snapshot (measured 2026-10-10: a plain `fetch` in a static
  page is cached for a year; `cache: "no-store"` under `dynamic = "force-static"` stays static and uncached).
- **GitHub failing never breaks the build or the page.** If the API refuses, the board still renders from the
  repo files and a banner says which data is missing and why.
- **Freshness = the last deploy.** Merges deploy within minutes while agents work. Known ceiling: a PR opened after
  the last merge isn't shown until the next deploy. The header shows the snapshot's time and age so nobody mistakes
  it for live. Upgrade path (not built): a scheduled redeploy through a Vercel deploy hook, which a person creates.
- **Locally:** `GITHUB_TOKEN=$(gh auth token) pnpm dev` re-collects on each reload (about 12 calls), for working on
  the page. `pnpm build && pnpm start` behaves like production.

## Requirements
**Data**
- A feature's state uses AGENTS.md's definitions: **done** = `changes/<slug>.md` on main; **in flight** = an open PR
  titled `feat(<slug>): ...`, which wins over the cut list; **ready** = every `depends_on` done and not in flight;
  **blocked** otherwise; **cut** = on a milestone's `cut` list; **backlog** = in no milestone's `features` or `allow`.
- Without PR data (no token, or the API failed), in flight can't be told from ready or blocked: those features show
  as **unknown**, never as a guess.
- Verified/not verified and gaps follow `status.py`: verified only when `## How to check it` has a passing
  `verify: ... pass` line and no failing or "not verified" line; gaps = the first line of `## Gaps` unless it says
  none.
- Main CI = the conclusion of the latest completed `push` run on `main`. Red is an ask; unknown shows as unknown.
  Each open PR's CI = its head's check runs, for the 25 most recent open PRs; the rest show unknown.
- Heat = PR activity on a feature in the 3 hours before the snapshot (one per PR touched, weighted toward recent).
  No per-PR detail calls.
- Workers come from `Worker:` in PR bodies; PRs without one are `unnamed`.

**Time.** Two clocks, never mixed silently.
- Everything read from the repo or GitHub is **as of the snapshot**. Server-rendered times are absolute (`Sat
  12:03`) or say "at snapshot". No "N min ago" is baked into the HTML.
- Only the wall clock ticks in the browser: the header clock, T+ since start, milestone countdowns, freeze and
  passed states, and the snapshot's age.

**Page**
- Header: brand, repo link, `snapshot <time> · main @ <sha>` (the commit built, also in `data-sha`), API status
  (`API: token · N calls · R/L left`, `API: no token`, or `API: failed`), wall clock, T+, snapshot age (amber past
  30 min).
- Sections, in pitch order, with demo keys 1-5 to jump and space to play the replay: the tour (below), milestones (countdown, freeze,
  cells per feature, what's left with in-flight ages at snapshot, pace forecast when 3 or more are left); needs a
  person, beside build stats (features built, PRs merged, agents active in 3 h, median PR open to merge, merged PRs
  by type, longest builds); the pipeline (AGENTS.md's loop with snapshot numbers); the crew (open PRs per worker with CI dots). Plus a ticker of the latest merges, an intro sentence, and a "since
  you last looked" banner (browser storage only).
- Sections that need PR data say so in place when it's missing, instead of rendering empty.

**The tour** ("Watch it get built"): first section, right under the header and intro.
- The site plan: the graph (critical path, hover trace, click card with spec/PR/done-note links, cmd-click to
  GitHub) and its replay, which scrubs from the first PR to the snapshot and plays it in about 24 s.
- **Counters**, large, for the scrubbed moment: features built of planned, PRs merged, and agents at work (named
  workers with a PR open at that moment, from the crew timeline's bars). At the snapshot they equal the board's.
- **Ticker:** the 3 latest merged PRs at the scrubbed moment, newest first, number and title.
- **Chapters**, marked on the scrubber and computed from the snapshot alone, never written by hand: the first PR;
  each milestone built (at the merge of the last of its live features; only milestones whose live features are all
  done); and the peak of PRs open at once (the crew timeline's peak, "N PRs open at once"). While playing, the
  last chapter passed shows as a caption.
- **Flash:** a node flashes once when its feature turns done during playback. No flash with reduced motion.
- **Motion** (#318; the tour is 25 seconds of watching, so it has to move like one continuous thing, not a slideshow):
  - The playhead advances on `requestAnimationFrame`, at display rate. Its speed eases up from rest when play
    starts or resumes (about 1 s) and slows into the snapshot over the last stretch, which it still reaches. A
    full play stays about 24 s. Pause, scrub and resume always continue from the current moment.
  - Node fill and stroke transition (about 350 ms) instead of snapping, both when a feature lands and when play
    rewinds to the first PR.
  - A feature landing also sends a ring out from its node, expanding and fading (transform and opacity only).
  - Edges from a feature that just landed draw outward toward the features it unblocks.
  - A counter bumps when its number changes. The ticker's newest merge slides in.
  - At the snapshot, heat and the critical path fade in instead of appearing.
  - With reduced motion the playhead still moves (it is the content), but nothing else animates or transitions.
- Without PR data the graph still renders; the replay, counters, chapters and ticker say they need PR data.

**Charts.** Both are drawn from the snapshot alone (no extra API call), server-rendered SVG, with a hover tooltip, a
legend or direct labels so identity is never colour alone, and a table view (`<details>`) for screen readers.
- **Build-up** (in "Will we make it?"): features built over time, one stepped line from the first PR to the
  snapshot; a step per feature whose feat PR merged, at its merge time. The x axis runs to the final milestone's
  freeze (its ship if it has none): the one real deadline for features. One target marker there: every live
  feature across all milestones. No marker for interim milestones (person's direction 2026-10-10: interim
  deadlines distort decisions and add nothing). A dashed line projects the last 3 h's pace (`pace()`) from the
  snapshot until it reaches the target or the freeze, whichever is first (never past the target: there are no
  features beyond it); the legend says when all land, or how many by the freeze. None when pace is unknown or the
  target is met. Hover: the time, built count and the
  feature that landed. Features done before the visible PR history (done note, no merged feat PR) count from the
  start.
- **Crew timeline** (top of "The crew"): one row per named worker with a merged or open PR, ordered by their
  first PR; one bar per PR from opened to merged, closed (hollow, dashed) or the snapshot (still open: outlined,
  pulsing). Colour by PR type: feature `#41ae61`, fix/refactor/perf/test `#a65d00`, plan/contract `#4b77cc`, any
  other type the neutral `#4a4338`. Validated (dataviz `validate_palette.js`, dark, surface `#14110c`): all checks
  pass, worst adjacent CVD ΔE 12.0. A worker's overlapping PRs stack into sub-rows, so no bar hides another. A strip
  above the rows counts PRs open at each moment; its peak is stated in the heading ("up to N open at once"). Hover:
  number, title, worker, opened → merged/closed/open. Click opens the PR.
- Neither chart renders without PR data; each says so in place.
- `noindex`, linked from nowhere in the product. No database tables, no product code changes, so it can't break the
  demo. `GITHUB_TOKEN` never reaches the browser or the HTML.

## Validation
1. **Unit (vitest, `tests/foreman/`)**, no network:
   - the board's state, ask, stats and replay rules on fixed inputs, including unknown states without PR data;
   - collector with no token -> zero fetch calls, files read from the real repo on disk;
   - collector with the API answering 403 -> stops after the first call, records the error, board still built;
   - collector against a fixed fake GitHub -> exactly the expected number of calls (the budget), CI mapped;
   - page render with no token -> board sections plus the banner, never an "unavailable" page.
2. **Build:** `pnpm build` -> the route table lists `○ /foreman` (static); `.next/cache/fetch-cache` holds no
   `api.github.com` entry; `grep -E "ghp_|gho_|github_pat_" .next/server/app/foreman.html` finds nothing.
3. **Verify:** `GITHUB_TOKEN=$(gh auth token) python3 .agents/scripts/verify.py --slug foreman --worktree .` ->
   Playwright on the production build: milestones as in the checkout's `milestones.toml`; one graph node per spec
   on disk; every open non-draft `plan:`/`contract:` PR and `needs-human` issue not updated since the snapshot is
   listed; header SHA = `/api/health` commit; hover trace, replay scrub, demo keys, since banner, card; screenshots.
4. **Charts:** unit tests pin the build-up series (steps, the freeze target, projection or none) and the timeline
   rows (one per named worker, bar ends, open bars end at the snapshot, sub-rows for overlaps, the concurrency peak) on fixed inputs; the
   e2e hovers one bar and one step and sees the tooltip, and finds both table views. Screenshot each chart.
5. **Production, after each deploy of this feature:**
   `FOREMAN_URL=https://knighthacks-2026.vercel.app pnpm exec vitest run tests/foreman/production.test.ts` -> the
   live HTML has every section, `API: token`, no failure banner, and its SHA equals the live `/api/health` commit.
   Run it again after the next merge to main: the SHA must have moved (one snapshot per deploy).
6. **Tour:** unit tests pin the chapters (first PR, a milestone built at its last live feature's merge, none for an
   unbuilt milestone, the peak equal to the timeline's) and agents at work at a given moment, on fixed inputs. The
   e2e checks the tour is the first section; Space plays it; a chapter caption and a node flash appear during
   playback; at the end the counters equal the snapshot's; with reduced motion no node animates. Screenshot it
   mid-playback. Motion: unit tests pin the playhead's speed curve (starts from rest, never above the base speed,
   reaches the snapshot exactly, a full play within 10% of its 24 s); the e2e sees a landing ring and an edge
   drawing during playback, and with reduced motion `document.getAnimations()` is empty while it plays. Measure
   frame intervals during a local play and report them in the PR.
7. Report `merged`, `checked by CI`, `verified locally` and `verified live` separately. A step not run is a gap in
   the done note.

## Defaults
Snapshot age amber past 30 min. Stale draft: 45 min without a push at snapshot time (the watchdog's number). Heat
and pace windows: 3 h. Open-PR CI cap: 25. If the spec is silent, show less and keep it truthful.
