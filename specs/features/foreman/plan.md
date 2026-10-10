# Foreman v2: implementation plan

How the page gets from what's on main (request-time GitHub reads) to [spec.md](spec.md) (one snapshot per
deploy). The spec is the contract; this file is the route and the reasons. Written 2026-10-10, before any code.

## 1. What went wrong, and why
On 2026-10-10 production showed "GitHub data unavailable: GitHub 403 on /commits/main (rate limit?)" and nothing
else. Root causes, in order of weight:
1. **The architecture read GitHub when the page was viewed** (`revalidate = 60`, plus `router.refresh()` every
   60 s from every open tab). Every regeneration made 2 + PR pages + issues + CI calls, plus one `/pulls/{n}` per
   PR touched in the last 3 h (#140), dozens at once. Load scaled with viewers and with activity, the opposite of
   what a hackathon needs.
2. **One failed call blanked the page.** `readRaw` threw on any error and the page rendered only the error.
   Specs, milestones and done notes were fetched through the same failing path even though they're plain files.
3. **The spec never changed.** It was written once (#118) and said "at request time, cached 60 s". 17 PRs later
   it described none of: heat from lines, ISR, auto-refresh, the pace forecast, the card, the since banner, demo
   keys, the pipeline. New behavior shipped under `fix(foreman)` titles to get past the "already done" rule
   instead of through a spec.
4. **Verification never touched production.** Every "pass" was a local build with a personal token (5000/h).
   Production health checks looked at HTTP 200, which the error page also returns. A test pinned the blank error
   page as correct behavior.

Process rules for this rewrite, and after it:
- Spec first, merged on its own (`plan:` PR). Code follows the spec; when the code needs the spec to change, the
  spec changes in the same PR.
- No feature work on foreman outside the spec. A new view = a spec change first.
- "Verified" is said per environment: local, CI, live. Live = Validation step 4 against the production URL, on
  page content.

## 2. Decisions and the alternatives
| Decision | Chosen | Rejected, and why |
|---|---|---|
| When data is collected | At build, once per deploy | Request time / ISR (what failed: load scales with viewers); a committed JSON snapshot (churn PRs on main, ownership conflicts); a scheduled GitHub Action writing a snapshot (needs `.github/`, frozen, and a store) |
| Repo files | Read from the checkout on disk | raw.githubusercontent.com by SHA (network, a second failure path, and a SHA race against main) |
| GitHub API | One pass, only with a token, bounded | Unauthenticated mode (60/h per IP, shared on CI and Vercel: fails at random) |
| Next fetch cache | `dynamic = "force-static"` + `cache: "no-store"` | Default `fetch` (cached for a year, restored between Vercel builds: the snapshot would freeze); `node:https` (also works, more code) |
| API failure | Board from files + banner; affected states `unknown` | Throwing (blank page, the bug); showing ready/blocked (a guess) |
| Main CI | Latest completed `push` run on main | The building commit's check runs (always "pending" during its own build) |
| Heat | PR activity, 3 h | Lines changed (one call per PR; the call explosion) |
| Freshness | Per deploy, age shown, amber past 30 min | Client polling (pointless on a static page); scheduled redeploy (needs a deploy hook a person creates: upgrade path, not built) |

Measured before deciding (Next 15.5.27, `pnpm build` with a token): a static page with a plain `fetch` is
prerendered, and the response lands in `.next/cache/fetch-cache` with `revalidate = 31536000`. With
`dynamic = "force-static"` and `cache: "no-store"` the route is still `○` static, the HTML holds the data, and no
fetch-cache entry is written. `node:https` gives the same result.

## 3. Module design
```
lib/foreman/collect.ts   (replaces github.ts)  server-only. readRaw(root = cwd, token = env, fetch = global)
lib/foreman/board.ts     pure model. Raw -> Board. Gains "unknown", api status; loses lines/heatBasis
lib/foreman/parse.ts     unchanged
lib/foreman/time.ts      new, shared clock/span helpers (server and client)
app/foreman/page.tsx     force-static; one readRaw() per build; no try/catch blanking
components/foreman/*     client islands; Live.tsx loses AutoRefresh; times rendered per the two-clock rule
```
`readRaw` contract:
- **Files:** walk `specs/features/*/spec.md` (skip `_`-prefixed), `specs/shipped/*/*/spec.md`, `changes/*.md`,
  `specs/milestones.toml`; `STOP` as a path. A missing `milestones.toml` throws: that's a broken checkout, not
  GitHub being down.
- **SHA:** `process.env.GIT_COMMIT` (next.config.ts sets it from Vercel's SHA or `git rev-parse HEAD`).
- **API, only with a token:** in order, stop at the first refusal:
  1. `/pulls?state=all&sort=created&direction=desc&per_page=100&page=N` until a short page (max 10)
  2. `/issues?state=open&per_page=100`
  3. `/actions/runs?branch=main&event=push&status=completed&per_page=1` -> main CI (failure on its own -> unknown)
  4. `/commits/<head>/check-runs?per_page=100` for the 25 most recent open PRs, in parallel; each failure -> unknown
  Every call: `cache: "no-store"`, a 10 s timeout, and the rate-limit headers recorded.
- **Returns** `Raw` plus `api: { token: boolean, calls, remaining, limit, error }` and `prsKnown: boolean`.

`buildBoard` changes:
- `prsKnown = false` -> any feature that would be ready, blocked or in flight is `unknown`. Done, cut and backlog
  stay (they come from files).
- Delete `PR.lines`, `Board.heatBasis` and the lines branch of heat.
- Pass `api` and `prsKnown` through to the board.
- `now` is the snapshot time. Stale asks and in-flight ages are relative to it, and the page says "at snapshot".

Page and component changes:
- `page.tsx`: `export const dynamic = "force-static"`; drop `revalidate`; `const raw = await readRaw()`;
  `snapshot = Date.parse(raw.fetchedAt)`; header shows `snapshot`, SHA, API status; banner when `api.error` or no
  token; no error-only branch.
- Ticker, lane ages, intro "since the first PR": absolute times, not "ago".
- `Live.tsx`: delete `AutoRefresh`; `HeaderClock` shows the snapshot age (amber past 30 min) instead of "data N
  old"; move `clock`/`span`/`TZ` to `lib/foreman/time.ts`.
- `SitePlan`: the replay ends at the snapshot; label `SNAPSHOT` instead of `LIVE`, button "back to snapshot".
- `Graph`: state `unknown` (dim, dashed); heat label always "PR activity".
- `Pipeline`: subtitle "numbers at snapshot".
- `Since`: unchanged (browser storage, no network).
- Crew, replay, ticker and asks without PR data: one line each, "needs PR data (see banner)".

## 4. Steps (each ends with its check)
1. **Spec PR** (`plan: foreman: one snapshot per deploy ...`): `spec.md` + this file. Checks: `check_ownership.py
   --lint-specs`, `--title`, `check_gates.py`, `check_markers.py`, CI green. Merge.
2. **Implementation branch** `foreman-snapshot`, PR `fix(foreman): collect once per deploy; a static page that
   survives GitHub failing`. Draft PR first.
3. **Reproduce on main first** (fix PR rule): a vitest that stubs `fetch` to answer 403 for `api.github.com`, then
   renders the page from main's code, expects the board, and fails. Paste the failing output into the PR.
4. `lib/foreman/time.ts` (move only) -> typecheck.
5. `lib/foreman/collect.ts` + delete `github.ts` -> unit tests: no token (zero calls, real files), 403 (one call,
   error kept), fake GitHub (exact call count = budget, CI mapping, 25-PR cap).
6. `board.ts` (unknown, api, drop lines) -> board tests updated plus a new "no PR data -> unknown" test.
7. `page.tsx` + components -> page render test (no token: sections + banner); `pnpm typecheck && pnpm lint &&
   pnpm test`.
8. Build check (Validation 2): route `○ /foreman`, no `api.github.com` fetch-cache entry, no token pattern in HTML.
9. e2e rewrite (`tests/e2e/foreman/foreman.spec.ts`): compare against the checkout on disk, not GitHub's tree;
   asks against open PRs not updated since the snapshot; replay label `SNAPSHOT`. Run verify with a token.
10. `tests/foreman/production.test.ts` (skipped unless `FOREMAN_URL`): fetch the live HTML and `/api/health`,
    assert sections, `API: token`, no failure banner, SHA match.
11. Done note `changes/foreman.md`: what shipped, the verify line, gaps (live check result, freshness ceiling).
12. Ready the PR -> CI -> `pr_ready.py` (exit code gated, retry on UNKNOWN) -> squash-merge -> remove worktree.
13. **Live:** wait for the Vercel deploy of the merge commit (`/api/health` = merge SHA), run Validation 4, then
    again after the next merge to main. Report both results with output.

## 5. Risks
| Risk | Effect | Mitigation / check |
|---|---|---|
| `GITHUB_TOKEN` not exposed to Vercel *builds* | Page shows "API: no token" banner, board from files | Visible in the header; Validation 4 asserts `API: token`; the person adds it to the build env if missing |
| Build cwd isn't the repo root | No files -> build throws on `milestones.toml` | Throwing is right here (loud); Vercel builds from the root today |
| GitHub slow at build | Build waits | 10 s timeout per call; at most ~37 calls, mostly parallel CI |
| Hydration mismatch from times | React warnings, flicker | Server renders only snapshot-relative text; ticking clocks start from the snapshot value passed down |
| A PR opened after the last merge | Not shown until the next deploy | Snapshot age in the header; upgrade path in the spec |
| Preview deploys and CI builds | Extra API calls | ~12 per build with a token, zero without |
| e2e flaking on main moving | False failures | Compare with the checkout and the snapshot time, never with live GitHub state that changed after it |

Rollback: `revert:` the implementation PR; the spec PR stays (it's what we want), and the revert note says the
code is behind it.

## 6. Out of scope (parked, not started)
- Crew timeline (Gantt of every PR per worker): branch `foreman-gantt`, one local commit. Needs a spec change first.
- Main CI health strip over time.
- Scheduled redeploy for freshness between merges (needs a Vercel deploy hook from a person).

## 7. Size
About 400 changed lines, mostly the collector, its tests and the e2e rewrite. One PR: the collector, the board's
`unknown` state and the page's two clocks only make sense together; split, any one would leave the page wrong.
