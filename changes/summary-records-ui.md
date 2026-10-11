## What shipped
- **Drawer:** a project with no description says "Gallery card only: Devpost lists a title and tagline; no description on record" next to its Devpost link, instead of "description unknown".
- **Evidence card:** the excerpt gets a text heading. It reads "From the gallery card (title and tagline only)" when `excerptSource` is tagline or title, and "Source text has changed since this card was made" when it's unknown.
- **Full records:** render exactly as before.
## Where it lives
`components/drawer/index.tsx` (`Description`), `components/evidence/index.tsx` (`EvidenceCard`), `tests/summary-records-ui/`, `tests/e2e/summary-records-ui/`
## How to check it
verify: `node scripts/verify.mjs summary-records-ui /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/summary-records-ui/20261011T083810Z` pass at 04296a5 (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/summary-records-ui/20261011T083810Z)
Run with `DATABASE_URL` = `TEST_DATABASE_URL`, a fresh absolute `AI_STUB_DIR` and `AI_STUB_ALLOW=1`. Desktop and phone screenshots of both drawers and the evidence card are in the evidence folder.
## Gaps
- **Collapsed details:** the summary line still reads "Uncertainty and source excerpt", so the gallery-card heading shows once the details are opened.
- **Styling:** the heading is plain text in the card's body style, because CSS here belongs to ui-redesign.
