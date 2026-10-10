---
name: A galaxy-first shell on desktop and a four-screen flow on the phone
depends_on: [visual-polish, voice, idea-create-ui, galaxy-history]
owns: [app/page.tsx, app/page.module.css, components/shell/, components/galaxy/index.tsx, components/galaxy/galaxy.module.css, tests/experience-shell/, tests/e2e/experience-shell/]
assignee: "eric-frontend-agent"
---

# Experience shell (#212)

Frontend only: Mac workers (user decision 2026-10-10, #212 option A, owner eric-frontend-agent). Today every panel
stacks in one long right column, and the phone gets the same stack. This feature replaces the page's layout with a
galaxy-first desktop shell and a deliberate phone flow. It changes where panels sit, not what they do: each panel
keeps its own feature's behaviour and tests. It builds on the star-chart look in `visual-polish` (Plan 4), which
keeps the tokens, fonts and panel styles; `app/page.module.css` moves here from visual-polish.

## Plan
1. Desktop (wider than 720px): a 52px top bar (wordmark, search, workspace); a 224px discovery rail on the left
   (galaxy history, the keyboard project list, "What am I looking at?"); the galaxy in the centre; a 360px
   contextual rail on the right (the selected project's drawer when one is open, then the idea path panels in
   order); a 72px composer along the bottom of the centre column.
2. Composer: the idea draft and push-to-talk in one bar. Typing and talking both write the shared `ideaDraft`;
   Interpret stays in the Idea panel. The draft textbox moves out of `components/idea/` through a separate
   `fix(idea-create-ui)` PR that exports it, coordinated in #212 with `problem-evidence-ui`, which also owns that
   folder.
3. Voice states, shown in the composer as text: idle, requesting permission, connecting, listening, committing,
   committed, connected-idle, mic-denied, unavailable, ending. They land in a `fix(voice)` PR that adds them to
   voice's own spec; `components/voice/` stays with voice (and voice-replies-ui), and the shell only places the
   voice bar in the composer.
4. Phone (720px or narrower): one `100dvh` screen at a time with four destinations (five once Plan exists, item 6), Explore (galaxy, search,
   history, projects), Talk (the composer), Idea (idea, revisions, evidence, challenge, branches, compare) and
   Decide (vote, decide, share, event tracks), switched by a fixed bottom navigation that respects the safe area.
   Opening a project pushes a history entry, so the browser's Back closes it.
5. `components/galaxy/index.tsx` and `galaxy.module.css` only: move the history and project-list controls into the
   discovery rail. Star rendering, picking and the camera belong to galaxy-classes-ui (`Scene.tsx`, `stars.ts`).
6. Plan step (#269): the flow is Explore → Talk → Idea → Decide → **Plan**. On the phone, Plan is a fifth destination.
   On desktop, Plan opens in the contextual rail once a version is chosen.
7. Mount slots: the shell mounts each #270 panel once its feature's component exists on main. The category legend
   and universe summary (`components/classes/`) go in the discovery rail, interview questions (`components/interview/`)
   in Talk, the scorecard (`components/scorecard/`) in Idea, the plan (`components/plan/`) in Plan, and the era board
   inside the explainer. A panel whose module isn't on main yet isn't imported, so the build never breaks.
8. Visual direction: `docs/design-references/` (desktop, phone, video frames), as summarised in #269. Mockup numbers,
   names, the activity feed, the impact preview and the globe are illustrative and are never shown as data.

## Requirements
- Partial voice text never changes the draft; releasing appends once; the text field works in every voice state,
  including mic-denied and unavailable.
- Keep `PanelState`, `ClaimBadge` text and shape labels, source links, visible unknowns, the keyboard project list,
  WCAG AA contrast and `prefers-reduced-motion`.
- No KPI grids, glass blur, gradient borders, bot avatars or continuous decorative motion.
- Phone targets are at least 44px; no horizontal overflow at 390px.
- Every landmark keeps its accessible name (Search, Galaxy, Idea and evidence, Voice), and each panel's own e2e
  suite passes unchanged.

## Validation
1. At 1440x900 the e2e measures the top bar, discovery rail, contextual rail and composer at 52, 224, 360 and
   72px (±1) and the galaxy filling the remaining centre; the history and project list sit in the left rail.
2. At 390x844: one destination fills the viewport with no page scroll past it and no horizontal overflow; each of
   the four navigation buttons shows its destination and is at least 44x44; open a project, press Back -> the
   project closes and the destination stays.
3. Keyboard: Tab reaches search, the project list, the composer and the rails in order, with a visible focus ring.
4. With the microphone denied, the composer shows mic-denied and a typed idea still interprets and saves.
5. `tests/e2e/experience-shell/` covers 1–4 (screenshots kept as evidence, not as the check), and the
   visual-polish, voice, galaxy, galaxy-history, idea-create-ui, bootstrap and demo-flow suites still pass, with
   visual-polish's contrast and claim tests unchanged.

## Defaults
CSS grid for the shell and a URL hash for the phone destination; no router change and no new dependency.
