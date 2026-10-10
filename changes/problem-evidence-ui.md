## What shipped
The saved idea card shows its problem and, under it, "Is this problem real?": a stored result loads on its own, otherwise the button runs the grounded search. Problem items come first (three, then "Show N more"), each with its claim and label, the source title (linked when there is a URL) and domain, its published date or "date not given", the event date when stated, and its relevance and label; solution items sit apart under "About solutions, not the problem". "Searched the web on" is always shown; a version with no problem gets a plain message.
## Where it lives
`components/idea/ProblemEvidence.tsx`, mounted in `components/idea/index.tsx`; `tests/e2e/problem-evidence-ui/`; the on-request default is in `specs/features/problem-evidence-ui/spec.md`.
## How to check it
verify: `node scripts/verify.mjs problem-evidence-ui .git/agent-evidence/problem-evidence-ui/20261010T181407Z` pass at ab5d0b5 (Mac; Neon test branch; real save; fixture evidence on a stubbed route; the no-problem case hits the real API once; screenshot `problem-evidence.png`). The idea card's e2e passes unchanged at the same commit: `node scripts/verify.mjs idea-create-ui .git/agent-evidence/idea-create-ui/20261010T181451Z` pass at ab5d0b5.
## Gaps
Not seen with a live grounded search (the API ran one live in #229). Production schema pending (#113).
