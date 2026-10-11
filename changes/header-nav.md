## What shipped
The header is navigation only: the Uncharted wordmark, Explore / Build tabs (`#build` survives a reload), and one compact workspace line. Search moved to a dock under the map, beside push-to-talk. The four filter selects sit behind a Filters button that shows an active count, with category first and Clear filters. Build gives the idea path a wide centred column over the dimmed galaxy.
## Where it lives
`app/page.tsx`, `app/page.module.css`, `components/shell/Tabs.tsx`, `components/shell/shell.css`, `components/search/`, `components/workspace/`, `tests/e2e/header-nav/`
## How to check it
not verified with verify.py, because it calls `playwright install`, which this container can't do. Instead, `playwright test tests/e2e/header-nav` with the preinstalled Chromium: passed. Before the rebase onto the black theme, experience-shell desktop, keyboard and phone, plus voice, also passed. After it, desktop and keyboard time out in this container, and the desktop test times out the same way on plain origin/main, so CPU-only GL here can't keep up with the new galaxy.
## Gaps
Not run here: search-filters-ui (needs the Neon search API) and guest-workspace-ui (needs the workspace DB). bootstrap fails locally only on 503/401 console errors from the missing workspace service. The mic-denied test needs `AI_STUB_DIR`. Explore still shows the idea rail; Build is a focus view on the same route, not a separate page.
