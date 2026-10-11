# Incident log

Things that went badly wrong, so agents and people don't repeat them. Newest first. Times are EDT. Only write
facts you can point to: a log line, an issue comment, a command's output. If the cause is unknown, write "unknown".

| When | Incident | Impact | Record |
|---|---|---|---|
| 2026-10-11 02:30–03:50 | Local e2e on a Mac at load average 21–57 (other agents' Playwright and embedding): runs timed out in setup, and a real failure was filed as load noise | About 70 min of the person's wait on a small UI fix. #399 shipped a bug (with reduced motion, clicking a project's name selected the wrong star) from 03:26 until #401 at 03:49 | [e2e-on-overloaded-mac](2026-10-11-e2e-on-overloaded-mac.md) |
| 2026-10-11 03:40–04:05 | The planner ran bulk Gemini labelling without approval or an estimate, on the key production falls back to | ~28.3M input tokens spent on 20,650 labels, unapproved. The spare key hit 429 on its per-minute quota, putting live AI features at risk. The primary key was already out of credit (402) | [gemini-labelling-spend](2026-10-11-gemini-labelling-spend.md) |
| 2026-10-11 02:35 | The 76,901 release was stopped by corpus-release's saved-idea gate: production held 14 saved idea versions | Publication paused about an hour while the person decided. Released only after their direct confirmation in the publisher's chat; saved rows left untouched | #262, comments from 06:35Z |
| 2026-10-11 02:09 | The Mac growth fetch stopped, 51 minutes before its 03:00 deadline | Collection ended at 57,488 full projects. **Cause unknown.** The planner first blamed a full disk, but the traceback it read was the 00:12 crash's, in a log last written at 00:14 | data files last written 02:09 |
| 2026-10-11 00:12 | The disk filled and crashed the Mac growth fetch (`OSError: [Errno 28] No space left on device`) | Fetch down until restarted. Every line of the data files was checked and valid, so nothing was lost | [disk-full](2026-10-11-disk-full.md) |
| 2026-10-10 23:02 | The Windows collector and its monitor exited with no error, refusal or backoff marker | Collection paused until recovered; the closed data validated with zero duplicates. **Cause unknown** | #262, comment 2026-10-11T03:06Z |

## Adding an incident
One row above. For anything with real cost or a lesson, also add a file `YYYY-MM-DD-<slug>.md` with these sections:
**What happened**, **Impact** (measured), **Failure points**, and **Rules from now on**. Use a `docs:` PR.
