# Windows backend claim

Worker: `kiro-agent-1`, GPT-6 Astra; Git author: Kiro. Claim: issue #67.
Base: `a5628a5`, including the accepted guest-workspace API and its recorded pending Mac verification.

Implement only this feature's route handlers, `lib/ideas/`, schema and tests according
to `spec.md` and placement decision D1. Use the existing workspace, AI and search
interfaces; do not add a framework or modify frontend/shared feature ownership.

The parent handles Git/GitHub and integration checks, one Astra builder owns the
implementation paths, and a separate Astra reviewer independently checks the result.
Keep live Neon/Hugging Face/provider acceptance distinct from unit or fixture checks.
Claude owns the separate `idea-create-ui` feature.
