# Windows implementation claim

Worker: codex-windows. Builder: GPT-6 Astra; separate GPT-6 Astra read-only reviewer. Scope: the shared server-only Gemini JSON client, claim-label validation, and feature tests as specified on main. Claude owns frontend; this feature changes no frontend files. Uses the already-pinned @google/genai and zod packages. Live credentials are optional for this feature because its spec explicitly permits fixture verification; any stub run will be labelled as such.
