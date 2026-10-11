# Incident: two agents loaded or tried to load production with different corpora (2026-10-11)

## What happened
- **02:22.** The planner posted, on the Mac's behalf, that the Mac would not load production and that
  codex-corpus-parallel was the sole publisher. It said claude-corpus-grow "has had no heartbeat for ~7 h"
  (#262, 06:22Z). claude-corpus-grow never acknowledged this itself.
- **02:26.** codex-corpus-parallel acknowledged that it was the sole publisher (#262, 06:26Z).
- **03:15 to 04:00.** The person gave go-aheads in separate chats:
  - 03:15 and 03:38: in the planner's chat, publish the 76,901 release (#262, 07:20Z and 07:44Z).
  - 03:50: in codex-corpus-parallel's chat, "merge the points now" (#262, 07:50Z).
  - 04:00: in codex-corpus-parallel's chat, publish the completed parts now. That became the 17,558-project
    subset, #404 + #407 (#262, 08:00Z).
  - claude-corpus-grow's PR (#411) says the person approved #262's option A and the production publish. When it
    got that approval isn't recorded on GitHub.
- **04:02.** claude-corpus-grow took the rollback copy `rollback-prod-20261011T080243Z` (8,409 rows). At about
  04:05 it **loaded 57,301 projects into production**, version `2026-10-11-57301` (#411).
- **04:15.** codex-corpus-parallel started its 17,558 production transaction. At 04:17 it **aborted at its
  before-write preservation gate**, because production no longer matched what it had validated. It made no
  production changes (#262, 08:15Z and 08:17Z).
- **04:20.** #411 opened with the matching `stars.json`. Its CI failed: `tests/galaxy-3d/layouts.test.ts › clouds
  don't overlap` timed out at 5,000 ms on the 57k layout. #413 merged a fix for that test at 04:27.
- **04:24.** The planner posted the collision and told codex-corpus-parallel to hold. In the same minute, a Claude
  session closed #262 "as superseded (person's call)", pointing at #404, the 17,558 release.

## Impact
- **Production is split.** Since about 04:05 the database has held 57,301 projects (`2026-10-11-57301`). The site
  still serves `stars.json` and `classes.json` for `2026-10-10-8409`. Whether search returned projects the map
  doesn't draw wasn't checked.
- **Nothing was lost.** All 57,301 ids are in the preserved 76,901 merged set (#262, 08:22Z). The pre-load 8,409
  rows are in `rollback-prod-20261011T080243Z`, and codex-corpus-parallel was backing up the 57,301 state.
- **Saved ideas weren't touched.** The 14 saved idea versions keep their old coordinates and corpus version (#411),
  which the person had accepted at 03:38.
- **No release is in.** Both release lines are held until the person picks one. Unresolved at the time of writing
  (04:35).

## Failure points
1. **Approvals reached three agents through three chats.** Each agent acted on its own chat's go-ahead. The
   approvals pointed at three different releases (76,901, 17,558 and option A) and none named a single writer.
2. **One agent stood another down.** The planner promised claude-corpus-grow would not publish, but
   claude-corpus-grow never agreed. A heartbeat file seven hours stale was read as a dead session. That session
   was alive.
3. **Nothing stops a second writer.** Only codex-corpus-parallel's own before-write gate caught the collision.
   There is no lock or "current publisher" record that a loader checks.
4. **The database was loaded before its bundle could merge.** #411's CI was red, so the database and the site's
   star map stayed out of step.
5. **Option A's precondition no longer held.** #262 recommended option A only "if a production check shows no
   saved ideas yet". Production had 14 by 02:35 (row above in the log).

## Rules from now on
- **One production writer, named by the person on the release issue.** Name the agent and the version. A go-ahead in
  one agent's chat doesn't authorize any other agent, and an approval relayed in a comment doesn't either.
- **An agent stands down only in its own words.** No agent acknowledges for another. A stale heartbeat doesn't
  prove a session is dead: check its processes or ask it.
- **Right before any production write, re-read production's `corpus_version` and row count.** Abort if they
  differ from what you validated, as codex-corpus-parallel's gate did.
- **Load production only once the matching bundle PR is green, then merge it right away.** Never leave the
  database and `stars.json` on different versions.
