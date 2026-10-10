# Mission

<!-- Agents reload this every run. Keep it under a page. Facts only: no invented numbers, dates or names. -->

## Why
A hackathon team picks its idea in the first hours, usually without knowing what has already been built or which
assumption will sink it. Uncharted shows them the field of past projects and tests their idea against it before
they commit. Source: the team's plan, `docs/UNCHARTED_V3_PLAN.md`.

## Who
Two teammates at a hackathon deciding what to build. At the event, a judge plays that teammate in the demo.

## What
A galaxy of real past hackathon projects, one star per project, placed by meaning. A user types or speaks an idea;
it becomes a star among its nearest real neighbors, with evidence cards on what overlaps and what differs. A critic
challenges one assumption at a time, the user accepts or rejects suggested revisions, the idea branches, two
teammates vote privately, and the chosen version leaves as a read-only share link with a QR code.

## Non-negotiables
- Never invent data. Unknown stays empty and visible.
- Every displayed project links to its source page. A record with no source URL is not indexed.
- Similarity is cosine similarity between embeddings, never distance between displayed 3D coordinates.
- Empty map space is never presented as originality, usefulness or chance of winning.
- Every claim the app shows is labelled `supported` (cites a stored source), `inferred` or `unverified`.
- A saved idea version never changes. Accepting a suggestion creates a new version; rejecting it changes nothing.
- Voice and text call the same server operations. With the microphone denied, the whole flow works by text.
- The API never returns a teammate's vote until both teammates have voted.
- A challenge session has at most 3 rounds; every critique names the assumption, source or test it is about.
- API keys (Gemini, ElevenLabs, Hugging Face, database) never reach the browser; speech uses short-lived tokens.
- A sponsor integration is claimed only if it runs in the deployed app.

## Not doing
- Accounts and logins: a guest session plus a teammate invite link only.
- A native mobile app: the share page works on a phone browser.
- Live crawling during the demo: the corpus is built offline before it.
- Sponsor integrations the product wouldn't otherwise use (see `roadmap.md`).
