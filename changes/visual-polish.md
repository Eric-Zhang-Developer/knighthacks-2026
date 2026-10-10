## What shipped
Shared panel pieces for every `-ui` feature: `<PanelState>` (loading, empty, partial, failed, offline; a glyph per kind, failures as alerts, optional Retry) and `<ClaimBadge>` (supported ●, inferred ◆, unverified ○, always with the label as text). Panel tokens (spacing, radius, type scale, a `--failed` state colour) and `.ui-panel` / `.ui-heading` in `globals.css`, applied to the search, drawer, explainer and voice panels. Voice gains a "Speak your idea" heading, and search results stack their metadata on phones. Behaviour is unchanged.
## Where it lives
`components/ui/` (import from `@/components/ui`), `app/globals.css`, `components/{search,drawer,explainer,voice}/`, `tests/visual-polish/`, `tests/e2e/visual-polish/`
## How to check it
verify: `node scripts/verify.mjs visual-polish /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/visual-polish/20261010T115625Z` pass at e6eeb57 (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/visual-polish/20261010T115625Z)
The search, project-drawer, galaxy-explainer, voice, galaxy and bootstrap e2e suites pass unchanged (15 passed). Desktop and phone screenshots are in the evidence folder.
## Gaps
- `ClaimBadge` isn't used anywhere yet: no finished panel shows claims. The idea and evidence `-ui` features should import it.
- `app/page.module.css` wasn't changed: the shell layout already uses the tokens it needs.
- Contrast is checked for the token pairs (all ≥ 4.5:1), not for every rendered element.
