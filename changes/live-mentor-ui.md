## What shipped
Recent-news source cards, guarded tool responses, and pending-tool cancellation when the selected idea changes.
## Where it lives
components/mentor/{Live,NewsCards,index,protocol}; tests/live-mentor-ui.
## How to check it
27 UI unit tests pass; TypeScript and focused ESLint pass. API companion #453 supplies verified seven-day Gemini news.
## Gaps
Not human-accepted for voice naturalness. Supplemental dev-browser run blocked by Next.js development overlay; canonical real-audio acceptance remains pending.
