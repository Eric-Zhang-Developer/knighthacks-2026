## What shipped
Material 3 dark tokens and Roboto Flex restyle every panel through the existing tokens; floating glass rails over a full-window chart; panels regrouped into brainstorming order with a sticky step index; four example sparks on an empty start; phone M3 navigation bar with icons and a drag-to-close project sheet (spring, velocity projection). Reduced motion, transparency and contrast fallbacks.
## Where it lives
`app/globals.css`, `app/layout.tsx`, `app/fonts/`, `app/page.tsx`, `app/page.module.css`, `components/shell/` (Steps, Starters, Sheet, spring), `specs/features/design-refresh/research.md`, `tests/e2e/design-refresh/`
## How to check it
verify: `node scripts/verify.mjs design-refresh …/agent-evidence/design-refresh/20261010T233540Z` pass at 112353f (Gemini stubbed via AI_STUB_DIR)
## Gaps
Panel error copy ("Couldn't…", red) belongs to each panel's feature and is unchanged. On a phone, category labels overlap at the fit zoom (galaxy labels). The phone sheet hangs from the top, not the bottom, so search and voice stay reachable (spec Plan 3). Not checked on a real touch device; drag tested with a mouse in Playwright.
