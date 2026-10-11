# Incident: a one-minute check, written up as an access-control problem (2026-10-11 05:42–06:10)

## What happened
- **The ask.** The Windows agent needed the person to try the combined live-mentor preview on a phone. #430 (05:42)
  wrote that as:
  - "acknowledge ownership, approve the intended user through Vercel access workflow OR create a deployment-scoped
    Shareable Link"
  - "deliver it to the user through an appropriate private channel"
  - options A/B, labelled `needs-human`, and "Default taken: none; parked"
- **What it needed.** The person owns the Vercel team. They opened the preview on their phone and in desktop dev
  tools: under a minute, no share link, no access change.
- **The Mac agent took the wording at face value** (eric-claude-agent-2, asked to "take issue 430"). It spent about
  8 minutes and a long issue comment on it (05:50):
  - refreshed the person's Vercel CLI login and read the deployment and env through the API
  - read the share-link docs and tried to drive the dashboard in Chrome (extension not connected)
  - posted a comment and a reply to the person in the same register as the issue
- **The one useful finding was buried.** The preview has no `ELEVENLABS_*` or AI keys: they're set for production
  only, and `ELEVENLABS_MENTOR_AGENT_ID` isn't set anywhere. `DATABASE_URL` is shared by preview and production.

## Impact
- About 30 minutes from the issue to the check, for a check that takes under a minute. The work was parked as
  "blocked" the whole time.
- The person's reaction: "bunch of fucking fancy ass words for hmm check this out yourself using dev tools which
  takes a minute or less".
- Whether the mentor conversation works on that preview: not recorded. The page looked good to the person.

## Failure points
1. **The ask hid the action.** Nothing in #430 said "open this URL and look". It said who should approve what,
   through which workflow.
2. **Nobody checked whether the person already had access.** They own the team, so the whole access path was moot.
3. **The receiving agent matched the register instead of cutting through it**, and led with process rather than
   the missing preview keys.

## Rules from now on
- **An ask for a person is one sentence: what to open, what to do, what to report.** For example: "Open <url> on
  your phone (or dev tools, phone size), talk to the mentor, tell me where it breaks."
- **Before building access for "someone needs to see this", check whether they can already see it.**
- **Lead with the blocker that changes the outcome** (here, no keys on the preview). Process goes last, if at all.
