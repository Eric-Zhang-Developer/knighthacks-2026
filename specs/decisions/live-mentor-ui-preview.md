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

## User correction: voice without a popup

The launcher no longer opens a conversation panel: it starts the persistent SDK session directly, or toggles
mute after connection. End remains beside it. Connecting gets a rotating ring, listening a slow pulse, and
speaking a faster ring plus animated bars driven by SDK state (not measured amplitude). Reduced motion removes
all of these animations, including pseudo-elements. No idle/failure animation pretends that an agent is speaking.

Optional Type / transcript opens inline in the contextual rail, not a centered floating popup. Candidate cards
render independently into the idea rail and remain available with the transcript closed. The call owner never
remounts when either view closes or navigation changes. Compact dismissible failure notices remain near the
bubble. Revealing the reviewed candidate preserves its bound pending confirmation; unrelated command navigation
still cancels it. Bottom navigation now notifies the hash subscribers when it replaces the destination.

The feature's own spec/Validation adds the human-requested popup-free behavior and motion checks; no real-audio
acceptance was removed. First 390px production-build regression run passed all three tests:
`verify: node scripts/verify.mjs live-mentor-ui C:\Users\kirol\OneDrive\Desktop\Knighthack\.git\agent-evidence\live-mentor-ui\20261011T021214Z pass at 769c0e5 (uncommitted changes)`.
Fixtures verify permission denial, initial privacy, connecting animation/reduced motion, duplicate taps, End
while permission is pending, dock/rail geometry, retained candidates and explicit save/cancel/replay behavior.
They do not establish successful WebRTC audio, speaking callbacks, actual ASR or persisted database writes.

Provider acceptance is still blocked: backend #355 is unmerged, and #357 records missing ElevenLabs convai_read
permission/private-agent configuration. Local real workspace initialization is also unavailable. Keep #369
draft, with no shipped note or production-acceptance claim. No Claude handoff, secret changes, new dependencies
or simulated spoken replies were introduced. Graphify's AST-only refresh skips two SQL files because its SQL
parser is unavailable; the modified TSX relationships are indexed without an API charge.

Final rerun after the navigation/confirmation review passed all three phone tests:
`verify: node scripts/verify.mjs live-mentor-ui C:\Users\kirol\OneDrive\Desktop\Knighthack\.git\agent-evidence\live-mentor-ui\20261011T021454Z pass at 769c0e5 (uncommitted changes)`.
Lint and all 415 unit tests pass (two opt-in tests skipped); Next production build includes TypeScript checking.
Phone screenshots were visually inspected: cards sit in the scrolling rail above the persistent bubble, and
Decide has no voice popup. The map itself still has crowded category labels, outside this iteration's changes.

## Live provider unblocked locally (2026-10-11)

After the human enabled ElevenAgents Write and Voices Read on the existing key, a fresh agent-list request
returned HTTP 200 (previously 401 / convai_read). Created one managed private agent using the backend's checked-in
tool/configuration definition: `agent_9401m4msvd0gepf81fg1c96pjnsk`, Gemini `gemini-2.5-flash`, Sarah voice
`EXAVITQu4vr4xnSDxMaL`. Read-back confirmed auth enabled, max duration 1200, record_voice=false, retention_days=0,
delete_transcript_and_pii=true, delete_audio=true, zero_retention_mode=false, and the exact get_context,
find_projects/propose_idea tool allowlist. Zero-day deletion is not the Enterprise Zero Retention Mode guarantee.
The operator prompt incorporates the canonical no-reflexive-praise behavior and the UI's explicit two-step
spoken save confirmation; provider tools still cannot write ideas. No unrelated agent was updated.

A local-only integration checkout at `C:/Users/kirol/.codex/worktrees/live-voice-integration/Knighthack` combines
UI 5fd97d7 and backend 9df58df, without merging either draft PR to main. Dependencies reuse the existing install.
The local runner `.git/agent-tools/run-mentor-preview.cjs` loads secrets in memory from the root local environment,
requires a distinct TEST_DATABASE_URL and uses that as DATABASE_URL. It sets the nonsecret agent ID explicitly.
No production schema, production configuration, key value, or stored provider capability changed or was printed.
The read-only isolated schema checker passed. Real local HTTP checks returned workspace 201, mentor session 200
with transport=webrtc and a nonempty token (discarded), and end-session 200. Cold compilation plus issuance took
30441 ms; that is not an audio-response latency measurement. The route is now warm on localhost:3107.

Browser automation rejected binding the localhost tab under its URL security policy. No alternate browser or
automation bypass was attempted. Human was asked to refresh, tap the bubble, allow the microphone and confirm
the audible greeting. Successful speech playback, interruption, grounded dialogue and full save/share acceptance
remain unverified until that check. Do not turn HTTP token success into a claim that a person heard speech.

## Signaling failure follow-up (2026-10-11)

Human reported `error reading from signal stream {}` and no audible response. Server logs confirm three
HTTP 200 session issuances followed by 429s. The isolated database shows those sessions ended within a second;
the member's three slots return at 06:34:01–06:34:30 UTC. Limits are unchanged (3/member/10 min, 12/workspace/hour),
including failed reservations. Provider conversation listing returned 200 with no retained conversations;
given the zero-day retention setting, that alone cannot prove whether a call started.

Installed client 1.27.0 / LiveKit 2.22.4 exposes `webRtc.singlePeerConnection`. The UI now explicitly selects
false to use the supported dual-peer handshake without replacing packages, using public agents or switching
tokens to the wrong transport. This is a compatibility mitigation, not a proven root-cause diagnosis: we do not
have the failing browser network status. Anonymous checks of both validate paths returned 401 as expected.
Sanitized connection notices never display raw capability-bearing errors; session 429 explains the real limits
instead of encouraging immediate retries. Focused tests: 20 passed; typecheck passed. Real audible greeting and
continuous conversation remain pending the next human attempt. No production deployment or acceptance claim.
