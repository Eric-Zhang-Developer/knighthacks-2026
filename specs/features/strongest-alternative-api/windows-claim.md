# Strongest alternative API claim

Worker: kiro-agent-1. Git author: Kiro. Builder and reviewer: GPT-6 Astra.

Implement only the canonical strongest-alternative-api spec: compare the saved version's highest-cosine neighbor against its workflow/problem, preserve labelled grounded claims, store once per version, and skip generation when workflow is absent. No frontend or outside-corpus research.

Builder exclusively owns app/api/alternative/, lib/alternative/, db/schema/alternative.ts and tests/strongest-alternative-api/. Root owns Git/GitHub, E2E, additive test-schema SQL and verification. Independent reviewer is read-only. No new dependencies or production schema mutation.
