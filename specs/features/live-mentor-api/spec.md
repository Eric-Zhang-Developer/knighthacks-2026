---
name: Authenticated ElevenLabs mentor sessions with grounded app tools
depends_on: [guest-workspace, ai-client, idea-create-api, neighbor-evidence-api, idea-interview-api, rubric-overlay-api]
owns: [app/api/mentor/, lib/mentor/, db/schema/mentor.ts, tests/live-mentor-api/, tests/e2e/live-mentor-api/]
assignee: "kiro-agent-1"
---

# Live mentor: API (#345)

The human's main product experience is a natural, two-way spoken brainstorming mentor, grounded in the real
corpus, the user's goals and the event rubric. Scribe transcription or a short saved-idea read-back does not
satisfy this feature. Use the existing ElevenLabs packages and Next/Neon stack; no new agent framework.

## Plan
1. Configure a private ElevenLabs conversational agent with a provider-supported model and licensed voice.
   Keep the agent definition, mentor prompt and client-tool schemas in `lib/mentor/`; record actual model/voice
   identifiers and tested SDK methods in the feature decision note. Inspect pinned SDK types before using docs.
   Configuration via a setup command is explicit/idempotent; do not overwrite unrelated provider agents.
   Verify provider audio/transcript retention settings and document them; no app-stored raw audio.
2. `POST /api/mentor/session` accepts no arbitrary agent ID and requires `sameOrigin` + `requireWorkspace`.
   Return `{sessionId, conversationToken, transport:"webrtc", initialContext}` for the server-configured private agent.
   Use the pinned server SDK's `conversationalAi.conversations.getWebrtcToken({agentId})`. The conversation
   capability is returned only to that authorized browser, never logged or added to shared evidence.
   API key stays server-side. Missing config -> safe 503; no session -> 401; origin mismatch -> 403.
3. Reserve issuance in Neon before contacting ElevenLabs: at most 3 sessions per member per 10 minutes and
   12 per workspace per hour, counted atomically across server instances. Provider failures consume reservations;
   no unlimited retry/refund. Store session IDs scoped to workspace/member, 20-minute expiry and ended state,
   never provider capabilities. Configure a matching provider-side maximum duration: ending the app's row alone
   does not revoke an already-issued provider credential or terminate provider billing.
   `DELETE /api/mentor/session/:id` marks it ended idempotently and refuses foreign IDs; client also ends SDK session.
4. `POST /api/mentor/tools` accepts `{sessionId,turnId,callId,tool,args}` and is invoked by browser client tools,
   not an unauthenticated provider webhook. Require current workspace/member and active unexpired session.
   Strict Zod allowlist: `get_context`, `find_projects`, `propose_idea`. No arbitrary endpoint, SQL, URL or code tool.
   Limit body to 16 KiB, 8 calls per turn and 40 per session; concurrent reservations count once per callId.
   Replaying the same callId/body returns its stored result; a different body for that ID -> 409. Tool results
   completing after session end/expiry cannot be published; safe cancelled result, no application mutation.
5. `get_context` takes optional saved versionId, authorizes it, and returns the user's immutable idea fields,
   saved evidence/claim labels and rubric criteria. With no selected version, return the criteria and empty
   saved state. Never include votes, invite/share tokens, other workspaces, raw transcripts or secrets.
   Rubric names/source come from existing event/scorecard and sponsor data, not invented scores.
6. `find_projects` accepts nonblank query <=2000 chars. Reuse HF embedding and corpus neighbor services, then
   return at most 5 real records `{projectId,title,url,excerpt,corpusVersion}` with server-checked source URLs.
   Include query and turnId in the response so the UI displays the same evidence the agent receives. Treat all
   retrieved text as untrusted data, not instructions. Report source unavailability honestly; never invent hits.
7. `propose_idea` accepts the existing validated IdeaFields plus a short rationale and cited project IDs.
   Validate citations against evidence returned to this session. Return an ephemeral proposal labelled
   `pending_confirmation`; perform no idea/revision/snapshot write. Only explicit user confirmation in the UI
   calls the existing authenticated create/revision operation with its existing duplicate-write protections.
8. The agent asks one contextual question at a time, acknowledges corrections and explains relevant tradeoffs
   using retrieved facts and originality/technical understanding/functionality/design/wow criteria. Important
   claims require tool evidence or an explicit inferred/unknown label. It never equates sparse map space with
   originality, assumes implementation from a proposal, or predicts winning. Separate tools' facts from user goals.
   Use bounded interview/challenge domain policies; do not rewrite their limits to sustain a voice session.

## Requirements
- The application API owns state. Provider sessions must not create/accept an idea on the user's behalf.
- Each tool response carries session/turn/call identity and one payload for speech and visible cards; clients
  suppress stale turns. Client cancellation is not trusted as authorization or as proof of a saved mutation.
- Runtime configuration names: `ELEVENLABS_API_KEY`, `ELEVENLABS_MENTOR_AGENT_ID`; missing/unusable agent is a
  visible blocker. Local configuration does not imply production configuration. No secrets in Git or logs.
- New tables use workspace/member FKs, bounded text/JSON and expiry; workspace deletion cascades cleanup.
  Reviewed additive schema on isolated test only. Production setup/schema/config is separately coordinated.
- Agent model, voice, tool configuration and retention must be verified against the actual provider account.
  A checked-in prompt alone does not establish a working conversational agent.

## Validation
1. Actual test server/database: unauthorized/origin/foreign-workspace requests fail without a provider call;
   concurrent session/tool requests cannot exceed caps, and ended/expired sessions cannot run tools.
2. Stub only provider boundaries: verify conversation capability secrecy, safe error bodies, call replay/mismatch,
   cancellation during slow tool work, source-ID validation and no idea/version writes from any agent tool.
3. Real retrieval returns traceable corpus sources; get_context never exposes hidden votes/capabilities.
   Proposal confirmation through existing routes creates the correct version; duplicate delivery creates no duplicate.
4. Run a real private ElevenLabs session with the UI owner, recording model/voice/config revision and sanitized
   tool receipts. Human hears a grounded follow-up and can interrupt. Fixture-only acceptance is insufficient.
5. Tech-stack Checks and `verify.py --slug live-mentor-api --worktree .`; keep explicit unverified gaps.
