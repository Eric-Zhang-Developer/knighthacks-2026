## What shipped
One Playwright run of the judge's demo path with live models: type an idea, see evidence, one challenge round, accept a revision, take two branches, invite a teammate who votes in a second browser, choose a version, then open the share link on a phone. Each step checks a result: every claim is labelled, the idea star is placed, two sibling branches exist, no vote shows before both have voted, the snapshot matches, and the share page sets no cookie. Step screenshots mask invite links, share links and QR codes.
## Where it lives
`tests/e2e/demo-flow/demo.spec.ts` (set `DEMO_BASE_URL` to run it against a deploy)
## How to check it
verify: `node scripts/verify.mjs demo-flow /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/demo-flow/20261010T153955Z` pass at ba9012e (evidence: /Users/ericzhang/code/hackathons/knighthacks-2026/.git/agent-evidence/demo-flow/20261010T153955Z)
Run with `DATABASE_URL` set to the Neon test branch, no `AI_STUB_DIR`, and `ANTHROPIC_API_KEY` empty, so Gemini (`gemini-3.8-flash`) answered every call. Local step times: idea 15.6s · evidence 26.2s · challenge 15.2s · revision 9.3s · branch 13.6s · teammate joins 5.2s · vote 9.8s · snapshot 1.4s · share on phone 1.7s, 98s in total. The labelled-claim check was confirmed to fail when inferred claims lose their badge. A secret scan of the evidence found no invite or share token and no session cookie.
## Gaps
- Validation 2 (production run) and 3 (`verify_release.py`, `demo_snapshot.py`) were skipped. Production is behind Vercel Authentication, `[release].url` is empty and #113 is open; see #171.
- Claude wasn't exercised (#61).
- Voice input isn't in the run; the typed box stands in for it.
- Demo finding: after branching, the chosen version is a branch with no evidence cards, so the snapshot's "What differs" is empty.
