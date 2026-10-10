## What shipped
A "Rehearse" section in the share panel, below the moment: list what works now (add, edit, remove, 1–8 items), then "Draft pitch". The pitch reads as sentences each marked Built or Planned (word plus shape), then three judge questions with the weakness each probes and a labelled basis. "Drafting…" disables the button; a failure says "Couldn't draft the pitch. Try again." and keeps the list. A stored rehearsal loads (and refills the list) without a POST. `/s/:token` never shows it or calls the API.
## Where it lives
`components/rehearsal/`, mounted in `components/share/index.tsx` (the moment heading now uses the chart serif); `tests/e2e/rehearsal-ui/`.
## How to check it
verify: `node scripts/verify.mjs rehearsal-ui .git/agent-evidence/rehearsal-ui/20261010T194548Z` pass at a3e6d47 (Mac; Neon test branch; real save, snapshot, share and rehearsal APIs; generation fixtures; 502 from a stubbed route; screenshot `rehearsal.png`). Phone width (390) checked: no horizontal overflow.
## Gaps
Not drafted live in the browser (rehearsal-api ran live in #255). `tests/e2e/moment-ui` fails on main because choosing a version now generates neighbour evidence with no fixture; fixed separately.
