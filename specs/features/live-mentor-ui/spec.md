---
name: A natural spoken mentor connected to the idea and evidence panels
depends_on: [live-mentor-api, voice, idea-create-ui, idea-interview-ui, neighbor-evidence-ui, design-refresh]
owns: [components/mentor/, components/voice/index.tsx, components/idea/index.tsx, tests/live-mentor-ui/, tests/e2e/live-mentor-ui/]
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

- Open on the full map with real project points. A circular, keyboard-accessible bottom-center bubble opens
  a conversation surface with typing and an explicit Start live conversation action. Never start the microphone
  on page load. The launcher stays reachable across Explore, Talk, Idea, Decide and Plan, including phone safe
  areas; navigation must not remount an active session or discard an unsaved draft. Closing the surface is
  distinct from ending the session: show a persistent active-state indicator and accessible End control.
- The side panel contains conversation outputs: proposed idea, sourced neighbors, risks/unknowns and next
  actions. Do not require a sequence of fields before brainstorming. Existing editable fields are optional
  refinement controls, and explicit confirmation still governs saves/revisions. Keep one canonical draft and
  proposal, not independent form and conversation copies that diverge.
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
  The header, the Filters disclosure and the compact workspace line moved to `header-nav`, together with
  `app/page.tsx`, `app/page.module.css` and `components/shell/` (person's decision 2026-10-11); this feature
  mounts its mentor through a `fix(header-nav)` or after header-nav is done. Remove the Hold to talk
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
  summary with unknowns visible and an explicit Save as new idea action. Do not hide an unchanged required
  form behind the bubble or overwrite edits when an older request completes.

The backend dependency and real-provider acceptance below remain required. This ownership change does not
authorize out-of-order shipping, production schema/configuration changes or merging a human-review plan.

## Plan
1. Start brainstorming is an obvious entry action, with a text alternative. Explain microphone use before
   permission; never listen automatically on page load. Await guest initialization before requesting a session.
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
   A visible explicit Save as new idea action invokes existing POST /api/ideas with stable idempotency; then update
   existing app state so the star, evidence and history reflect the confirmed version. Cancel changes nothing.
   Show that saving from a selected existing idea creates a separate idea, not a revision. Existing revision
   controls remain unchanged; conversational editing of a persisted revision is not claimed by this slice.
6. Typing remains available throughout microphone denial, provider failure or disconnect. Use existing text
   interpretation/interview/save flow; preserve the draft and selected idea. No forced voice-only onboarding.
7. Use a human-tested realistic voice and concise, context-specific replies; don't recite all rubric criteria
   every turn. Evidence links and uncertainty remain visible while speech conveys the relevant point naturally.
   Measure actual response/interruption latency and document gaps rather than claiming an invented target.

## Validation
0. User-requested idea management: a compact saved-idea selector with a clear Add idea action, selected title
   and secondary per-idea Delete action. Reuse existing create/list APIs and the coordinated
   `DELETE /api/ideas/:ideaId` contract. Keep desktop controls compact and phone controls in a readable sheet
   or disclosure; no crowded repeated forms. Buttons must be keyboard accessible with visible focus and
   comfortable touch targets. Confirm the exact title before deletion, explain all versions will be removed
   and existing decision snapshots/shared exports remain, with access to existing share revocation.
   Cancel performs no request. Keep state on failure and announce success only after the API succeeds.
   Creating another preserves existing saved ideas. Switching clears stale version-specific evidence and
   pending mutations; deletion removes its stars/history selection and selects a remaining idea or an empty
   draft. Late callbacks must not restore deleted content or apply an old confirmation to a new selection.
   Voice supports explicit add/list/select/delete intents through the same app state and authorized routes.
   Resolve the target against current workspace ideas; ask when names are ambiguous. A voice deletion request
   opens the same named confirmation; require the visible destructive confirmation button, never a bare yes,
   transcript substring or provider tool mutation. Inform the mentor of the confirmed result/current selection.
   Test two saved ideas, switching, deleting selected/unselected/last idea, cancellation, failure, duplicate or
   stale voice callbacks, foreign IDs and reload at 390px and desktop. Real spoken acceptance stays separate
   from mocked SDK tests. codex-conversation-ui owns these frontend changes; coordinate with kiro-agent-1.
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
