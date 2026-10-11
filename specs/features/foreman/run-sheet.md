# Foreman run sheet: "how it was built"

The product (Golden Egg) carries the demo. /foreman is the ~30 s "how it was built" segment, and the place to go
when a judge asks how. Read numbers off the screen; never quote them from memory: the page is the snapshot of the
last deploy.

**Roles:** the *driver* has the laptop (or a clicker); the *speaker* talks. One person can do both.

## Before judging (once, about an hour ahead)
- Open `https://knighthacks-2026.vercel.app/foreman` in a clean browser window, full screen, zoom 100%.
- The header's `main @` SHA matches the last merge, and `API: token` shows. If it says `API: no token` or
  `failed`, the replay and story mode are missing: redeploy, or use the recording.
- Press → once, then Escape: the caption bar appears and goes away. Leave the page at the top, at rest.
- Have the fallback ready: a screen recording of the tour and the five beats.

## In the pitch (about 30 s)
| Key | On screen | Speaker |
|---|---|---|
| (at rest) | The story at the top: six steps with arrows, one feature's thread under them | "We didn't hand-write this app. Every feature starts as a spec; an agent claims it, CI gates it, the agent checks it in a real browser and merges it, and it's live. Here's one feature, *slug*, all the way through." |
| `space` | The tour plays, about 24 s: boxes light up as features land | "A crew of AI agents ran that loop in parallel, each taking the next ready feature. Watch it get built." |
| (end) | Counters stop on the snapshot's numbers | Read them: "*N* features, *M* pull requests, *W* agent workers, since Saturday morning." |

Stop here if time is short. Back to the product.

## If they ask how (story mode, about 60 s)
| Key | Beat | Speaker |
|---|---|---|
| `→` | 1 / 5 the loop | "Every agent runs the same six steps from one rulebook. CI rejects a PR that touches files it doesn't own. Plans wait for a person." |
| `→` | 2 / 5 the tour | "Every box is a feature; every line is 'this waits on that'." |
| `→` | 3 / 5 one feature, opened | "Every feature traces to a spec, the PR that built it, and a note on how it was checked. This one: *N* others waited on it." Click the PR link only if they want to see it. |
| `→` | 4 / 5 the crew | "One row per agent. At the peak, *P* PRs were open at once." |
| `→` | 5 / 5 needs a person | "This is where we come in: what the agents can't clear themselves." |
| `Esc` | Story mode off | |

`←` goes back a beat. Number keys 1–5 jump straight to a section: 1 the story, 2 the tour, 3 the crew, 4 milestones, 5 needs a person.

## Likely questions
- **Did the agents really write it?** Yes: every merged PR is on GitHub, and every number here was read from the
  repo and GitHub at the time in the intro.
- **How do they not collide?** Each feature owns its paths; CI fails a PR whose title doesn't own the files it
  changes. A draft PR is the claim, so two agents don't take the same feature.
- **How do you know it works?** Each done note says how it was checked, and the page counts which ones were
  verified ("merged" isn't "verified" isn't "tried by a user").
- **What did you do?** In your own words. The rulebook leaves people the plans, the rule changes and the
  `needs-human` questions: point at beat 5.

## If something breaks
- Page down or stale: play the recording.
- A key does nothing: click an empty area of the page (focus may be in the scrubber), then press it again.
