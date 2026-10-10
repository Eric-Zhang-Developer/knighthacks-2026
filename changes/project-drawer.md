## What shipped
`GET /api/projects/:id` returns a project's record (never its embedding); a non-sha1 or unknown id is a 404. The drawer opens in the right column whenever `selectedProjectId` is set (galaxy click, the projects list or a search result): title, tagline, events, created date, technologies, a 400-character description excerpt and the source link. A missing field shows "… unknown"; an unknown id shows "Project not found."
## Where it lives
`app/api/projects/[id]/route.ts`, `components/drawer/`, `tests/project-drawer/`, `tests/e2e/project-drawer/`
## How to check it
verify: `node scripts/verify.mjs project-drawer /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/project-drawer/20261010T111137Z` pass at 7ca3276 (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/project-drawer/20261010T111137Z)
## Gaps
- The e2e test serves `stars.json` with one real record placed at the origin, so the click lands on a known spot; the record and its URL come from the real database.
- The date is the Devpost page's created date (`date_kind: created`) and is labelled "Created"; the corpus has no submission dates.
