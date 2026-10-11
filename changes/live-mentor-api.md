## What shipped
Authenticated live mentor with corpus/rubric context, natural validation coaching, optional sponsor guidance and Gemini-grounded seven-day news. App issuance/turn/session quotas removed per human request; provider duration set to its documented7200-second ceiling. Operator prompt and explicit confirmation are preserved.
## Where it lives
`app/api/mentor/`, `lib/mentor/`, `db/schema/mentor.ts`, owned tests and `specs/decisions/live-mentor-api-demo-policy.md`.
## How to check it
71 combined mentor API/UI unit tests, TypeScript and focused ESLint pass; actual TEST database schema/store-runner passed all9 checks including10 session starts,12 calls/turn and48/session with ownership/replay/end/expiry intact. Live Gemini3.8-flash search at2026-10-11T10:37Z returned1 cited fox13news.com item within the verified seven-day window.
## Gaps
Provider setup must follow matching client-tool deployment; existing databases need the reviewed20-minute-to2-hour constraint update (TEST applied, production not claimed). Human voice/interrupt quality and full browser acceptance remain unverified; no production completion claim. Provider limits/outages remain possible. Existing privacy and save-confirmation decisions are preserved.
