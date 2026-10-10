## What shipped
Inside "What am I looking at?", a board of when projects were started: through 2022, 2023–2024, 2025 onward, and start date unknown. Each group shows its project count and what teams' own descriptions say about AI coding tools (used / said they didn't / not stated), computed at render time from `stars.json` and `classes.json`. Below it, three dated tool releases, each linked to its source.
## Where it lives
`components/era/` (index.tsx, era.ts, CSS), `components/explainer/index.tsx`, `specs/decisions/era-board-ui-sources.md`, `tests/era-board-ui/`, `tests/e2e/era-board-ui/`
## How to check it
verify: `node scripts/verify.mjs era-board-ui /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/era-board-ui/20261010T234355Z` pass at 8f34063 (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/era-board-ui/20261010T234355Z)
The e2e recomputes every count from the two files and checks that the four rows sum to 8,409 and each row's tool-use counts sum to the row.
## Gaps
- When the grown corpus (#262) ships before classes.json is re-run for it, the board shows start dates only and says tool use isn't loaded.
- The ChatGPT date was checked through Wikipedia's citation of OpenAI's post, because the post itself returns 403 to automated fetches (decision file).
