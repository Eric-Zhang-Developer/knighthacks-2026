# First implementation preview

The human explicitly authorized merging plan #365 and implementation/preview work while the backend is
unfinished. #365 was squash-merged with its exact head after its CI passed. #369 remains a draft, not a
completed feature or production release. No production provider configuration, schema or application data was changed.

Implemented: persistent bubble, lazy-loaded ElevenLabs conversation controls, same-origin session/tool client,
typed interpretation/interview adapter, unsaved proposal with explicit idempotent save, compact Team menu,
filter disclosure, secondary map controls disclosure, removed primary explainer/dictation bar and collapsed
secondary idea panels. Search/workspace presentation paths were added to this feature's scope to implement
the human's phone screenshot feedback; their API contracts are unchanged.

Checks: TypeScript and ESLint pass; Vitest 402 passed, 2 opt-in tests skipped. Local browser at 390x844 showed
the bubble opening, real SDK Start live conversation control loading, and draft text remaining after switching
to Idea. The page no longer mounts the Scribe dictation bar. Graphify AST updated without provider calls.

Gaps: localhost workspace initialization reports unavailable, so real typed generation/save was not verified.
Hosted branch preview returned Vercel You Need Access for the signed-in browser account; protection was not
disabled. Backend #355 remains unmerged, #357 provider permissions/configuration remains a known blocker.
No actual microphone/provider session was started, no human audio acceptance, no production-build verify.py
receipt, no complete new browser regression suite, and no claim that all older placement-dependent tests pass.
Map-label collision work is not included. Do not merge/mark complete on unit tests alone.

Next: authenticate the hosted preview or configure an isolated local test workspace, then run the typed
conversation -> proposal -> explicit save -> evidence/decision/share journey. Complete dependency #355 and
actual private-agent audio/interruption validation before declaring live mentorship functional.

## User correction: one tap and parallel candidates

The next user review explicitly rejected a second Start button and chatbot-first entry. The launcher now
invokes a preloaded SDK controller directly from its click; mounting/hash navigation never requests a mic.
Typing and the transcript are optional disclosures. A synchronous duplicate-start guard and connection timeout
protect session startup; mute/end stay explicit. Selecting a candidate no longer ends the live connection.

Distinct `propose_idea` payloads become retained candidate cards (three per page, older pages kept). Exact
redelivery is deduplicated. Each candidate has its own save key, full optional fields, and an explicit Proceed
action. Confirmed saves update selected-version context without discarding other candidates. Explore another
direction starts an explicitly separate text draft or asks the connected agent for another direction.
The existing provider tool contract has no candidate identity/refinement field: changed proposals are retained
as separate candidates, not guessed replacements. This is a UI capability, not proof the remote agent obeys it.

The feature's own Validation was expanded for this user correction, not weakened. Unit suite: 405 passed,
2 opt-in skipped. Browser boundary tests deliberately mock denial, workspace, interpretation and save; they
cannot establish provider speech, genuine model reasoning, database persistence or human audio acceptance.
Initial verify run failed during Next build (`no direct app page entry found for /_not-found`) with dev running;
the dev process was stopped and its generated cache moved outside the checkout for a clean verification retry.

Clean retry: both 390px browser boundary tests passed against the production build. Receipt:
`verify: node scripts/verify.mjs live-mentor-ui C:\Users\kirol\OneDrive\Desktop\Knighthack\.git\agent-evidence\live-mentor-ui\20261011T014931Z pass at c6da3a8 (uncommitted changes)`.
Screenshots in that evidence directory show the denied-mic fallback and fixture candidate cards. The initial
build failure is retained above rather than omitted. Typecheck and lint also pass. Live provider, full SDK
disconnect/interruption races, real generation/save, and human audio acceptance remain unverified; keep #369 draft.

## Hands-free app actions

The human clarified that no buttons should be required after deliberate call entry. Added a bounded whole-
utterance command adapter to the existing SDK user-message callback and typed composer: navigation, candidate
review, team-menu opening (no invite), minimize/end, and two-step candidate save. Agent/tool messages never
enter the command adapter. No new provider tool or server permission was added. The app binds an explicit
"confirm save idea N" to the reviewed card's ID, fields, retry key and one-minute expiry, consumes it before
network I/O, and invalidates it on unrelated input, edits, navigation or session replacement. Bare "yes" is not
confirmation. Existing button controls remain alternatives. Sharing/voting/invites/revisions are not voice-enabled.

Checks: typecheck and lint pass; 415 unit tests pass with 2 opt-in tests skipped. The first browser run passed
save/cancellation assertions but its helper incorrectly expected a visible composer after navigation minimized
the panel; the helper now checks the intended hidden-panel/hash outcome instead. The rerun passed both tests:
`verify: node scripts/verify.mjs live-mentor-ui C:\Users\kirol\OneDrive\Desktop\Knighthack\.git\agent-evidence\live-mentor-ui\20261011T020216Z pass at e1f9fb7 (uncommitted changes)`.
These use typed commands and mocked workspace/idea endpoints, not a real microphone, provider or database.
Actual ASR, spoken acknowledgement timing and full zero-button journeys remain acceptance gaps behind #355/#357.
