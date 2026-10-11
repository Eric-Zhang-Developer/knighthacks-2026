# Completed corpus checkpoint

Version: `2026-10-11-17558`. The bundle contains 17,558 unique full projects, including all 8,409 previously published IDs and 9,149 additions. Every project has a source URL, cached BAAI/bge-m3 vector, and validated source-hash-matched project/prize labels. The remaining merged records are excluded pending preparation.

## Validation
- Matching stars/classes IDs, count and version verified; zero duplicate IDs/URLs or missing source links.
- Classification build: 0 model calls, 0 failed projects/prizes, 147 honestly marked insufficient_text.
- Test database: 17,558 loaded, release bundle check passed.
- `node scripts/verify.mjs corpus-release` passed (14 tests).
- `node scripts/verify.mjs corpus-embed` passed (8 tests), including real HF own-title nearest-neighbour checks and bundle/table parity on test Neon.
- Typecheck and lint passed. Application test rerun uses two workers after two import-time timeouts with 90 workers; timeout thresholds are unchanged.

## Publication and rollback
The sole publisher is codex-corpus-parallel. The user explicitly requested this completed subset. Saved ideas and versions are not updated; earlier saved positions retain their original corpus version. The prior 8,409-project database (including vectors), stars/classes, 10 ideas and 14 versions are backed up outside Git with checksums. Production loading requires successful CI and test validation; all pre-existing saved rows are compared after loading, permitting only concurrent new saves. The final release receipt records deployment checks.

The large generated JSON diff is expected: this replaces a versioned corpus bundle, not application code. Never expose the private rollback files or credentials in this repository.

Application rerun result: 492 passed, 2 skipped; 88 test files passed, 2 skipped.
