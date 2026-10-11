---
name: A navigation-only header (Explore / Build), with search and filters moved to a dock under the map
depends_on: [experience-shell, search-filters-ui, guest-workspace-ui, ui-redesign]
owns: [app/page.tsx, app/page.module.css, components/shell/, components/search/, components/workspace/, tests/header-nav/, tests/e2e/header-nav/, tests/e2e/search-filters-ui/, tests/e2e/experience-shell/]
assignee: "eric-claude-agent-4"
---

# Header nav (person's decision 2026-10-11, 03:20 EDT, in session)

The person, looking at production: the header is "a relic from a previous century". One 52px bar holds the
wordmark, a tagline, the search box, four filter selects that truncate ("All categor…"), the workspace ID, a
cookie warning and Invite. Headers are for navigation. This feature takes the header, filter and workspace-menu
bullet from live-mentor-ui (reassigned by the person; `app/page.tsx`, `app/page.module.css` and
`components/shell/` move here) and ships it as a targeted change before the freeze.

## Plan
1. **Header = navigation.** Desktop top bar: the wordmark (Cormorant, sentence case, no tagline) on the left; two
   tabs in the middle, **Explore** (the galaxy) and **Build** (the idea path: idea, evidence, grow, test, decide,
   plan); the workspace on the right as one compact line (ID, Invite, and the no-recovery notice kept visible but
   quiet). Nothing else lives in the header.
2. **Explore / Build on one route.** The tab lives on `<html data-view>` and in the URL hash (`#build`), so a reload
   keeps it. Explore is the current galaxy-first layout. Build gives the idea path the stage: a wide centred column
   over the dimmed galaxy, with the discovery rail and dock hidden. Shared state (`ideaDraft`, the selected project,
   saved idea) is untouched by switching. The phone keeps its bottom navigation; the header tabs are desktop-only.
3. **Search moves to a dock at the bottom of the map**, beside push-to-talk. Results open upward over the map.
4. **Filters behind one button.** The four selects (category, prize, event, created year) move into a Filters
   popover opened from the dock, category first; the button shows how many are active, and the popover has Clear
   filters. Behaviour of each filter is unchanged.

## Requirements
- Landmarks keep their names (Search, Galaxy, Idea and evidence, Voice, Workspace): other suites find them.
- The no-recovery notice stays visible in the Workspace region (guest-workspace-ui's journey checks it).
- Keyboard: the header tabs are links with `aria-current`; the Filters button has `aria-expanded`; Escape closes
  the popover; the filters still follow the search box in tab order once open.
- No new dependency. WCAG AA contrast and 44px targets as in ui-redesign.

## Validation
1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
2. `tests/e2e/header-nav/`: at 1440x900 the header contains the wordmark, Explore and Build, and no search box or
   select; the search box is inside the dock under the galaxy; Filters opens the four selects and shows a count
   once one is set; Build hides the discovery rail and shows the Idea card in the wide column, and `#build`
   survives a reload; Explore brings the galaxy back with the typed draft intact.
3. `tests/e2e/search-filters-ui/`, `experience-shell`, `bootstrap`, `voice` and `guest-workspace-ui` still pass.
   Two move with the layout, and nothing else in them changes: the filters suite opens the Filters popover first,
   and experience-shell measures the dock instead of the voice footer, with search before push-to-talk in tab
   order.
