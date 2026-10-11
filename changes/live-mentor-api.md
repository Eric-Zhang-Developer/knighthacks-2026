## What shipped
Authenticated live mentor with corpus/rubric context, natural validation coaching, optional sponsor guidance and Gemini-grounded seven-day news. App issuance, turn and session quotas were removed at the human's request; provider duration is set to its documented 7,200-second ceiling. Operator prompt and explicit confirmation are preserved.
## Where it lives
`app/api/mentor/`, `lib/mentor/`, `db/schema/mentor.ts`, owned tests and `specs/decisions/live-mentor-api-demo-policy.md`.
## How to check it
Not verified with a new local built-app run during final API integration; 71 combined mentor API/UI unit tests, TypeScript and focused ESLint pass. The actual TEST database schema/store runner passed all 9 checks, including 10 session starts, 12 calls per turn and 48 per session, with ownership, replay, end and expiry controls intact. Live Gemini 3.8 Flash search at 2026-10-11T10:37Z returned one cited fox13news.com item within the verified seven-day window.
## Gaps
Provider setup must follow matching client-tool deployment; existing databases need the reviewed 20-minute-to-2-hour constraint update (TEST applied, production not claimed). Human voice/interrupt quality and full browser acceptance remain unverified; no production completion claim. Provider limits and outages remain possible. Existing privacy and save-confirmation decisions are preserved.
