# Share API implementation claim

Worker: kiro-agent-1. Git author: Kiro. Builder and independent reviewer: GPT-6 Astra.

Implement the current canonical share-qr-api spec only: authenticated creation of a 128-bit URL-safe capability for a frozen snapshot, cookie-free public reads, and owning-workspace revocation. Store only token hashes. No frontend, added framework or production schema mutation.

Root owns Git/GitHub, database validation, E2E and the final done note. Builder exclusively owns app/api/shares/, lib/shares/, db/schema/shares.ts and tests/share-qr-api/. Independent reviewer is read-only. Real Neon acceptance and current CI/review gates remain required.
