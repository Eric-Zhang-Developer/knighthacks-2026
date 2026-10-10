## What shipped
"Assumption map" in the challenge panel: the idea at the centre and four labelled clusters (need, data, feasibility, differentiation), each assumption a numbered node button named by its text. An edge joins two assumptions only when they cite a same project. Selecting a node (mouse or keyboard) shows its claim with `ClaimBadge`, its kind, the cited projects (each opens the drawer) and its test, or "evidence is insufficient". No assumptions -> an empty state pointing at "What would change your mind?". Static layout, no motion, no model call, no new dependency.
## Where it lives
`components/challenge/AssumptionMap.tsx`, `components/challenge/constellation.ts` (layout and edges), the `onLoaded` hand-off in `ChangeMind.tsx` and `index.tsx`; `tests/constellation-ui/`, `tests/e2e/constellation-ui/`.
## How to check it
verify: `node scripts/verify.mjs constellation-ui .git/agent-evidence/constellation-ui/20261010T173743Z` pass at cf309ed (Mac; desktop and phone; stubbed assumptions citing real projects; screenshots `map-*.png`, `selected-*.png`). Unchanged suites at cf309ed: challenge-ui `.../challenge-ui/20261010T173830Z` pass, prove-it-ui `.../prove-it-ui/20261010T173924Z` pass, change-mind-ui `.../change-mind-ui/20261010T174014Z` pass.
## Gaps
Not seen with live model assumptions; cited project titles come from the version's evidence cards and fall back to a short id when none are stored.
