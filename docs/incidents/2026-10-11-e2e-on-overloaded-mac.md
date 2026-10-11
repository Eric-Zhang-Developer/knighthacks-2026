# Incident: local e2e on an overloaded Mac burned an hour and hid a real bug (2026-10-11 02:30–03:50)

## What happened
- **The change.** A small galaxy-3d fix: sharper stars when zoomed in, and project names up close (#399). The code
  was written and checked on the real GPU early. Most of the time after that went into running the e2e suite
  locally.
- **The machine was overloaded by other work.** Other agents were running their own Playwright Chromium, a Chrome
  renderer at 118% CPU, and `corpus/embed/run.py` on the same 8-core Mac. `uptime` read:
  | Time | Load average |
  |---|---|
  | 02:40 | 21 |
  | 02:45 | 43 |
  | 03:00 | 34 |
  | 03:18 | 57 |
  | 03:46 | 26 |
- **What that did to the runs.**
  - Two runs never started tests: `Timed out waiting 240000ms from config.webServer`.
  - An interrupted run left `.next` without a finished build, so the next server start failed (`Could not find a
    production build`).
  - Full-suite runs failed 4, 9 and 11 of 11 tests. They timed out during page setup, at the 5 s polls for
    `data-classes` and the canvas test hooks, before reaching any code the PR changed.
- **The real bug hidden in the noise.** One test, "a name selects its project", failed every run with the same
  message: `<canvas> … intercepts pointer events`. It was filed under load noise and #399 merged at 03:26 with it
  failing.
  - **The PR's claimed cause was wrong:** `overflow: hidden` scrolling the name layer, written without a trace.
  - **The real cause, traced later:** pointerdown landed on the name button and pointerup on the canvas, because the
    name's box moved from (580,380) to (256,45) at pointerdown. Under reduced motion, `app/globals.css:303`
    (`button:active { transform: none !important }`) wiped the transform that positioned the name.
  - **The fix:** #401 positions names with `translate` instead, merged 03:49.
- **CI didn't catch it.** CI runs typecheck, lint and unit tests (about 2 min) but no e2e.

## Impact
- **About 70 minutes of the person's wait** on a frontend change whose code was done early. "what the fuck got you
  stuck in a loop for a whole ass hour".
- **A shipped regression, live from 03:26 to 03:49.** With reduced motion on, clicking a project's name selected
  whatever star sat under the pointer instead of that project.
- **A wrong cause in #399's PR body**, corrected in a comment on #399.

## Failure points
1. **Ran the full e2e suite on a shared, overloaded machine** without checking `uptime` first, then repeated it.
2. **Treated every failure as load.** A test that fails the same way, with the same message, every run, is a real
   failure. Load failures time out at different steps.
3. **Wrote a cause without evidence.** The overflow theory went into the PR before any trace showed it.
4. **No e2e in CI**, so a local run on a loaded machine was the only e2e check.

## Rules from now on
- **Check `uptime` before e2e.** Above the core count (8 on this Mac), don't run the full suite. Run only the spec for
  the change, or wait.
- **Same failure, same message, twice: it's real.** Trace it (event targets, element boxes) before merging.
- **Write a cause only after a trace or a log line shows it**, or write "unknown".
- **For UI changes:** check on the real GPU, run the spec for that feature, let CI pass, then merge. Don't loop on
  the full suite.
