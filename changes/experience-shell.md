## What shipped
Desktop: 52px top bar, 224px discovery rail (legend, history, project list, explainer) inside the Galaxy landmark, the galaxy in the centre over a 72px voice composer, a 360px contextual rail (open project first, then the idea path and decide panels). Phone: Explore / Talk / Idea / Decide, one per screen, via a bottom nav and the URL hash; an open project is a sheet that Back closes.
## Where it lives
`app/page.tsx`, `app/page.module.css`, `components/shell/` (nav, global phone sizing), `components/galaxy/index.tsx` (controls portal into the rail), `tests/e2e/experience-shell/`
## How to check it
verify: `node scripts/verify.mjs experience-shell …/agent-evidence/experience-shell/20261010T215127Z` pass at 57b17be
## Gaps
Plan 2 changed: the idea textbox stays in the Idea card (`specs/decisions/experience-shell-composer.md`). Plan 3's voice states aren't built (a `fix(voice)` PR; voice shows only its existing hold / listening / added / blocked texts). Decide has no event-tracks panel (none exists yet); build-plan-ui (#298) isn't mounted. Validation 5: visual-polish, voice, galaxy-history, galaxy-explainer, idea-create-ui, project-drawer pass; galaxy and bootstrap fail on main's /api/workspace/state 401 (#288); demo-flow needs live models (not run); search's "type a query" test fails without this change too.
