---
name: A natural spoken mentor connected to the idea and evidence panels
depends_on: [live-mentor-api, voice, idea-create-ui, idea-interview-ui, neighbor-evidence-ui, design-refresh]
owns: [components/mentor/, components/voice/index.tsx, components/idea/index.tsx, components/search/index.tsx, components/search/search.module.css, components/workspace/index.tsx, components/workspace/workspace.module.css, app/page.tsx, app/page.module.css, components/shell/, tests/live-mentor-ui/, tests/e2e/live-mentor-ui/]
assignee: "codex-conversation-ui"
---

# Live mentor: UI (#345)

The user explicitly reassigned this frontend to this Windows Codex chat (worker codex-conversation-ui),
superseding the earlier Mac handoff for this slice only. The user identifies realistic live mentorship as the main selling point. Integrate it
through the existing voice entry point, after coordinating #221/#324/#346 and design-refresh; no competing edits.
Keep the existing app navigation and source-backed idea/evidence panels. This is not isolated dictation or TTS.

## Conversation-first entry and contextual rail

This section supersedes experience-shell's dictation composer and form-first placement, and design-refresh's
empty-start sparks, only when this feature ships. Existing functional controls remain reachable; acceptance
tests must assert preserved behavior through the new entry rather than require the obsolete placement.

- Open on the full map with real project points. A circular, keyboard-accessible bottom-center bubble starts
  a live ElevenLabs call in one tap, with no hold gesture or second Start button. Typing and transcript are optional
  disclosures, not the primary call surface. Explain microphone use on the entry. Never start the microphone
  on page load. The launcher stays reachable across Explore, Talk, Idea, Decide and Plan, including phone safe
  areas; navigation must not remount an active session or discard an unsaved draft. Closing the surface is
  distinct from ending the session: show a persistent active-state indicator and accessible End control.
- The side panel contains conversation outputs: proposed idea, sourced neighbors, risks/unknowns and next
  actions. Do not require a sequence of fields before brainstorming. Existing editable fields are optional
  refinement controls, and explicit confirmation still governs saves/revisions. Retain multiple distinct candidate
  ideas, showing up to three compact cards per page with title, audience, problem, approach and known constraints.
  Unknowns stay explicit; do not invent risks. Keep full fields available without truncating the card's main facts.
  Deduplicate exact proposal redelivery. Preserve earlier candidates when more arrive; never silently evict one.
  Each card's Proceed with this idea action saves that candidate only, with its own stable retry key, without
  ending the live call. Update the agent's context only after a confirmed save. No automatic candidate selection.
- Ask one contextual question at a time about audience, motivation, constraints, evidence and alternatives.
  Challenge weak assumptions constructively, including why the idea might fail or succeed and what is missing.
  Never default to praise or present unsupported confidence. After roughly two or three useful exchanges offer
  exploration or team collaboration, without a compulsory count, forced navigation or endless questioning.
  The user chooses when to move on. Existing challenge-mode limits remain unchanged.
- Offer explicit navigation actions to existing exploration and teammate controls. No new provider tools,
  invitations, saved mutations or expanded API privileges are implied. Prompt changes in lib/mentor remain
  with live-mentor-api's owner; frontend copy alone cannot establish the provider's behavior.
- Use a near-black neutral map surround, readable white text and restrained accents. Scope glass styling to
  the owned shell/mentor surfaces: translucent fills, subtle borders and limited blur with solid fallbacks.
  Preserve WCAG AA, reduced-transparency, reduced-motion and high-contrast behavior. Do not replace project
  categories with fabricated data or obscure the map beneath a permanent form rail.
- Phone cleanup from the user's screenshot: remove the Projects/Events/Categories totals strip and the
  "What am I looking at?" explainer from the primary shell. Move secondary discovery/history controls out of
  the initial viewport into an explicit disclosure; retain an accessible project-list alternative to the map.
  Replace the four cramped inline filter selects with a clearly labelled Filters disclosure/sheet, full-width
  readable fields, active-filter summary and Clear filters. Keep the search field directly reachable.
  Use a compact brand/header with a workspace menu for the identifier and cookie-persistence explanation;
  keep an obvious teammate action without a permanent multi-line workspace banner. Remove the Hold to talk
  dictation bar from the shipped primary experience rather than showing it alongside the new bubble.
  These changes require a coordinated ownership amendment for search/workspace/discovery components before
  editing those features' files; do not conceal controls with broad CSS or delete their behavior/tests.
- Typing is a conversational alternative, not only a dictation destination. Reuse the existing authorized
  interpretation/interview operations and bounded policies. Provider failure must be explicit; never simulate
  a live ElevenLabs session or silently substitute canned spoken replies.
- The text adapter presents one returned interview question at a time in the same transcript, carrying answers
  into the next authorized interpretation. It must not render the current list of answer inputs as the primary
  conversation. Offer Skip/Explore/Review proposal without saving implicitly. Respect the API's answer-count
  limit and show an honest completion/limit state; do not reset counters silently for an endless interview.
- Keep detailed idea fields behind an optional Edit details disclosure. The default proposal is a readable
  summary with unknowns visible and an explicit Proceed with this idea action. Do not hide an unchanged required
  form behind the bubble or overwrite edits when an older request completes.

The backend dependency and real-provider acceptance below remain required. This ownership change does not
authorize out-of-order shipping, production schema/configuration changes or merging a human-review plan.

## Plan
1. Start brainstorming is an obvious entry action, with a text alternative. Explain microphone use before
   permission; never listen automatically on page load. Request microphone access directly from the user's tap;
   await guest initialization before reserving a provider session. Loading or direct #talk navigation only opens
   the surface; it must not grant microphone consent. Duplicate taps cannot reserve multiple sessions.
   Use `ConversationProvider` and `useConversation` from installed `@elevenlabs/react` 1.17.0; start with the
   authorized `conversationToken` and `connectionType:"webrtc"` from live-mentor-api. Never combine a signed
   WebSocket URL with WebRTC. Pinned startSession/endSession return void: connection/error callbacks establish
   readiness/failure, not awaiting those methods. Client tools serialize structured results to JSON strings.
2. Show connecting/listening/thinking/speaking/ended/failed/permission-denied states truthfully. Mentor greets
   briefly, asks about the problem and user, listens naturally and asks one relevant follow-up at a time.
   Keep readable user/mentor transcript, mute and End session controls accessible. In this pinned SDK, the
   explicit Stop control ends the conversation and is labelled Stop and end; do not invent an interrupt() hook
   or treat volume=0/sendUserActivity as proof of cancelled generation. Natural spoken interruption is separate.
3. Natural interruption must stop the old speech and let the user correct the direction. End releases audio
   tracks and provider connection, aborts tool requests and marks the server session ended. Suppress old
   session/turn callbacks. Reconnect starts an explicitly authorized fresh session, never replays old writes.
4. Register only the exact API client tools. Fetch through the same-origin authenticated browser; do not give
   provider tools cookies or arbitrary URLs. A tool blocks the agent until its actual result/error is available.
   The same tool payload populates visible sourced project cards, relevant rubric criteria and the proposal;
   speech cannot claim a tool succeeded while the UI shows a failure. Keep untrusted evidence as data.
5. Mentor remembers current conversation goals/constraints and loads only authorized selected-version context
   on resume. Corrections update the proposed idea visibly. `propose_idea` is a preview, never an automatic save.
   A visible explicit Proceed with this idea action invokes existing POST /api/ideas with stable idempotency; then update
   existing app state so the star, evidence and history reflect the confirmed version. Cancel changes nothing.
   Show that saving from a selected existing idea creates a separate idea, not a revision. Existing revision
   controls remain unchanged; conversational editing of a persisted revision is not claimed by this slice.
6. Typing remains available throughout microphone denial, provider failure or disconnect. Use existing text
   interpretation/interview/save flow; preserve the draft and selected idea. No forced voice-only onboarding.
7. Use a human-tested realistic voice and concise, context-specific replies; don't recite all rubric criteria
   every turn. Evidence links and uncertainty remain visible while speech conveys the relevant point naturally.
   Measure actual response/interruption latency and document gaps rather than claiming an invented target.

## Validation
1. Real human/demo hardware: start -> spoken idea -> relevant spoken follow-up -> answer -> interrupt/correct
   -> inspect real related projects -> justified refinement -> explicit confirm -> correct persisted idea and
   map state -> existing decision/share journey. Record the actual voice/model and human feedback.
2. Browser tests with SDK/provider mocked only: permission denied, delayed connect, connection loss, mute,
   stop, end during a tool, stale callback after reconnect, duplicate tool/proposal delivery and late response.
   Assert no ghost speech or unexpected save; text path stays usable and unsaved draft survives failure.
3. Validate speech/tool payload and rendered evidence identify the same turn/version and real source links.
   User correction survives subsequent questions; private votes/share capabilities never enter tool messages.
4. Keyboard, 390px phone and desktop checks; existing voice, idea-create and interview suites still pass.
   Tech-stack Checks and `verify.py --slug live-mentor-ui --worktree .`; mocked audio cannot replace step 1.
5. At desktop and 390px, start on the map; open the bubble; type without completing a form. Navigate every
   existing destination with the same conversation/draft retained. Closing/reopening the surface keeps truthful
   session state; End releases audio. No launcher/control overlap, horizontal overflow or inaccessible focus.
6. Human audio run includes a weak initial assumption, a relevant non-sycophantic follow-up, a correction and
   user-selected exploration/team navigation. Visible evidence and proposal match the conversation. Repeat the
   complete typed path with denied microphone permission; no automatic saves, invites or lost draft.
7. Text acceptance: a fresh user types a vague idea, gets one relevant question, answers in the same composer,
   corrects an assumption, skips further questions, reviews the proposal and confirms a single save without
   opening Edit details. Replay the save and deliver an older interpretation late: no duplicate or overwritten
   proposal. Keyboard focus returns to the launcher after closing; text and controls stay usable with the phone
   software keyboard open. Tests use provider fixtures only for deterministic failure/race cases, not as proof
   of real conversation quality. See acceptance.md for the baseline gaps and required evidence.
8. One bubble tap attempts microphone/session connection without opening a required composer or second Start.
   Mount, reload and hash navigation never start audio. Minimize/navigation retain the same active call; explicit
   End releases it. Three distinct proposals yield three separately actionable cards; duplicate delivery adds
   none. Selecting one saves its exact fields once and retains the others and the live connection. More than
   three candidates are paginated without losing data. These fixtures are not a real ElevenLabs audio receipt.

## Hands-free confirmation amendment (human request)

After initial microphone consent, buttons are alternatives rather than required per-turn controls. The UI may
interpret a bounded set of explicit, whole user utterances from the SDK user-message callback (or typed input):
show a destination, show a numbered candidate, open the team menu without sending an invitation, minimize,
end, request save, confirm save, or cancel. Agent speech and retrieved/tool content never execute UI commands.
Do not imply that this small command vocabulary understands every possible phrasing.

Spoken saving is explicit user confirmation in the app, not a new provider mutation tool: a request to save a
numbered card first displays its exact candidate and asks for "confirm save idea N". Bind this review to its ID,
save key and fields, expire it after one minute, and consume it synchronously before the existing POST /api/ideas.
Wrong numbers, edits, ended/reconnected sessions, unrelated intervening user utterances and a bare "yes" do not
authorize a write. The ordinary button remains available. Preserve idempotency on retries; report confirmed
success or failure back to the agent without sharing capabilities. Sharing, invitations, votes and saved-version
revisions remain outside this UI command set until their own reviewed contracts cover spoken confirmation.

Validation adds parser tests for quoted/negated/ambiguous prose and binding/expiry/edits, plus phone browser
tests showing a requested save does not write, explicit confirmation writes only that card, and duplicate or
cancelled confirmation does not write. Mocked text/SDK inputs do not establish real ASR or spoken acceptance.
