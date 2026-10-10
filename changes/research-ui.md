## What shipped
The saved idea card has "What already exists?" under the problem check: a stored result loads on its own, otherwise the button runs the GitHub and Hugging Face search. Items sit under four headings that say what each means (direct alternatives, adjacent work, research, building blocks), two per group then "Show N more", each with its name linked in a new tab, its source, its popularity with the metric named, its description and its labelled reason. A source that failed reads "GitHub didn't answer (403); try again later". Hugging Face models and datasets never show as direct alternatives, enforced again on the client.
## Where it lives
`components/idea/Research.tsx` and `research-groups.ts`, mounted in `components/idea/index.tsx`; `tests/research-ui/`, `tests/e2e/research-ui/`; the on-request default is in `specs/features/research-ui/spec.md`.
## How to check it
verify: `node scripts/verify.mjs research-ui .git/agent-evidence/research-ui/20261010T183402Z` pass at ed66e13 (Mac; Neon test branch; real save; fixture research on a stubbed route; screenshot `research.png`). Unchanged suites at the same commit: `problem-evidence-ui` 20261010T183449Z pass, `idea-create-ui` 20261010T183604Z pass.
## Gaps
Not seen with a live search in the browser (research-api ran one live in #228). Production schema pending (#113).
