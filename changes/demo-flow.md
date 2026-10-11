## What shipped
The live two-browser demo covers idea creation, labelled evidence, challenge, revision, branches, private voting, chosen-version snapshot and a phone share. Exact Save matching tolerates interview buttons; API assertions reject early vote disclosure and require the public share to equal the chosen frozen snapshot.
## Where it lives
`tests/e2e/demo-flow/demo.spec.ts`; set `DEMO_BASE_URL` for the deployed run. Screenshots mask invite/share links and QR codes; tracing is off.
## How to check it
verify: `node scripts/verify.mjs demo-flow "C:\Users\kirol\OneDrive\Desktop\Knighthack\.git\agent-evidence\demo-flow\20261010T224605Z"` pass at 41ad538; live Gemini gemini-3.8-flash through the working spare, dedicated test Neon, no fixtures or Claude; 1 test passed (2.5-minute journey, 4.1-minute build/run), 380 unit tests passed and 2 existing opt-in skips.
## Gaps
Production demo (Validation 2) remains pending Vercel spare-key configuration by its owner (#297); Windows lacks that team access. Release health/secret scan passed at f206dce and homepage snapshot was saved at 77055d8, not this commit (Validation 3 still needs its final receipt). Human microphone and Claude are untested. First cold build exceeded the unchanged 240-second startup limit; one cached retry passed without weakening checks.
