# Live mentor delivery contract

## Context and choice
The pinned ElevenLabs React SDK 1.17.0/client 1.27.0 returns void from startSession/endSession and supplies no tool-call ID to client tool handlers. The app owns HTTP identities, session authorization and cancellation. Server SDK 2.71.0 uses conversationalAi.conversations.getWebrtcToken({agentId}); WebRTC uses conversationToken, not signedUrl.

POST /api/mentor/session takes JSON `{}` and returns sessionId, conversationToken, transport and initialContext. Keep the token in the authorized browser only. Client tools POST strict bodies to /api/mentor/tools. Generate callId as lowercase SHA-256 of `sessionId:turnId:tool:canonical(args)`, where canonical sorts object keys recursively and preserves array order; normalize/validate arguments before hashing. Advance turnId once per committed user utterance, not per partial transcript or duplicate event. lib/mentor/contract.ts is the algorithm reference; it imports Node crypto and must not be imported into a browser bundle.

Successful tool replies are `{sessionId,turnId,callId,tool,data}`. Identical pending delivery returns HTTP 202 with those identities, status pending and Retry-After: 1; poll the same body with a bounded wait shorter than the provider tool timeout, cancel on session end, and never fabricate a replacement call ID. Replays return the stored data without execution or another budget reservation. A failed call becomes a safe terminal failed payload. Never present it as success. Ended/expired calls return 409; foreign sessions return 404. The UI suppresses stale turns and shares the same data between spoken tools and visible cards.

get_context accepts optional versionId. find_projects accepts query. propose_idea accepts `{fields,rationale,sourceIds}`, with all six nullable idea fields. Tools stage proposals only. An explicit UI confirmation saves exact fields through existing POST /api/ideas with a stable idempotency key. For a selected saved idea label this Save as new idea; no arbitrary revision or parent link is implied.

## Alternatives and reversal
Provider IDs are unavailable at this SDK boundary; random IDs on every delivery would defeat replay protection. Atomic per-workspace budget and per-session call rows serialize concurrent requests without relying on process memory or snapshot-prone advisory-lock counts. Reversing this choice requires changing both browser delivery and server replay contracts together.

## Acceptance still required
Provider model/voice, private-agent authentication, 1,200-second maximum and separate audio/transcript retention controls must be checked on the real account. SDK lifecycle callbacks determine connection state; there is no public interrupt() method. Spoken interruption and an explicit Stop and end control require actual UI/human verification. Ending the app row alone cannot revoke an already-issued provider capability. No production configuration or human voice acceptance is claimed here.
