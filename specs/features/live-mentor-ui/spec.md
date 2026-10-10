---
name: A natural spoken mentor connected to the idea and evidence panels
depends_on: [live-mentor-api, voice, idea-create-ui, idea-interview-ui, neighbor-evidence-ui, design-refresh]
owns: [components/mentor/, components/voice/index.tsx, tests/live-mentor-ui/, tests/e2e/live-mentor-ui/]
assignee: "eric-frontend-agent"
---

# Live mentor: UI (#345)

Mac owns this frontend. The user identifies realistic live mentorship as the main selling point. Integrate it
through the existing voice entry point, after coordinating #221/#324/#346 and design-refresh; no competing edits.
Keep the existing app navigation and source-backed idea/evidence panels. This is not isolated dictation or TTS.

## Plan
1. Start brainstorming is an obvious entry action, with a text alternative. Explain microphone use before
   permission; never listen automatically on page load. Await guest initialization before requesting a session.
   Use `ConversationProvider` and `useConversation` from installed `@elevenlabs/react` 1.17.0; start with the
   authorized `conversationToken` and `connectionType:"webrtc"` from live-mentor-api. Never combine a signed
   WebSocket URL with WebRTC. Pinned startSession/endSession return void: connection/error callbacks establish
   readiness/failure, not awaiting those methods. Client tools serialize structured results to JSON strings.
2. Show connecting/listening/thinking/speaking/ended/failed/permission-denied states truthfully. Mentor greets
   briefly, asks about the problem and user, listens naturally and asks one relevant follow-up at a time.
   Keep readable user/mentor transcript, mute, stop-speaking and End session controls accessible.
3. Natural interruption must stop the old speech and let the user correct the direction. End releases audio
   tracks and provider connection, aborts tool requests and marks the server session ended. Suppress old
   session/turn callbacks. Reconnect starts an explicitly authorized fresh session, never replays old writes.
4. Register only the exact API client tools. Fetch through the same-origin authenticated browser; do not give
   provider tools cookies or arbitrary URLs. A tool blocks the agent until its actual result/error is available.
   The same tool payload populates visible sourced project cards, relevant rubric criteria and the proposal;
   speech cannot claim a tool succeeded while the UI shows a failure. Keep untrusted evidence as data.
5. Mentor remembers current conversation goals/constraints and loads only authorized selected-version context
   on resume. Corrections update the proposed idea visibly. `propose_idea` is a preview, never an automatic save.
   A visible explicit Confirm action invokes existing create/revision APIs with stable idempotency; then update
   existing app state so the star, evidence and history reflect the confirmed version. Cancel changes nothing.
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
