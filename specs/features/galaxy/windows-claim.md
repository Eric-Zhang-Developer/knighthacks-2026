# Windows galaxy claim

Worker: `astra-windows-galaxy`, GPT-6 Astra, Windows.
Base specification: `6ecec2d`, `specs/features/galaxy/spec.md`.
Scope: the galaxy feature's existing owned component and test paths; no added dependencies.
Implementation: one GPT-6 Astra builder; parent handles verification, independent local review, and GitHub gates.
Coordination: the draft `feat(galaxy)` PR is the claim; re-fetch `origin/main` and inspect other claims before further work.
