# Demo continuity and mentor grounding

Context: on 2026-10-11 the human explicitly requested no application usage caps, natural evidence-informed mentorship, opt-in sponsor challenges and only current problem news.
Choice: remove usage-count quotas while retaining authentication, duplicate-call identity, payload bounds and ended-session rejection. Use the documented ElevenLabs maximum 7200 seconds, with explicit reconnect/text fallback; no unlimited-provider guarantee. Seven-day news requires verified page publication dates, cited grounding and inferred relevance, with an honest empty result.
The owned schema expands only mentor_session_duration from 20 minutes to 2 hours. Existing rows remain valid; no table or data is removed. Existing test/production deployments require the following separately coordinated constraint replacement before new code issues two-hour sessions (the create-only checker deliberately does not repair it automatically):

```sql
ALTER TABLE public.mentor_sessions
  DROP CONSTRAINT mentor_session_duration,
  ADD CONSTRAINT mentor_session_duration CHECK
    (expires_at > created_at AND expires_at <= created_at + interval '2 hours');
```

Provider configuration uses the existing chosen voice/model and privacy choices, preserves operator prompt text and adds an idempotent current-policy block. Setup must be applied to the exact managed agent only once the matching client tools are deployed. Human audio acceptance remains necessary. No other agent or provider privacy configuration is changed implicitly.
How to undo: restore the prior code/policy; do not shorten the constraint until existing two-hour sessions have ended. No data cleanup is required.
Sources: https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow and the pinned SDK types.
