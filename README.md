# knighthacks-2026

Uncharted: a voice-guided galaxy of hackathon projects that helps teammates turn an idea into an evidence-backed
decision about what to build. Built at Knight Hacks IX.

## Where the plan lives

`specs/` is the source of truth: [mission](specs/mission.md), [tech stack](specs/tech-stack.md),
[roadmap](specs/roadmap.md) and [milestones](specs/milestones.toml). Each feature is a folder in `specs/features/`.

[docs/UNCHARTED_V3_PLAN.md](docs/UNCHARTED_V3_PLAN.md) is the original long-form plan. Its feature catalog (§2)
and product invariants are reference for writing feature specs; its stack and two-computer process were replaced
by `specs/`.

All changes reach `main` through pull requests; agents follow [AGENTS.md](AGENTS.md).

## Run locally

Use Node 22+, pnpm 10.32.1 and Python 3.11+ for repository checks. From the repository root:

```sh
pnpm install --frozen-lockfile
```

Copy `.env.example` to `.env.local` and fill it privately. Use an isolated Neon development database for
`DATABASE_URL` and a separate test branch for `TEST_DATABASE_URL`; never use production for local verification.
Semantic retrieval needs `HF_TOKEN` and `EMBED_MODEL=BAAI/bge-m3`; structured generation needs at least one
configured generation provider. For Gemini, set `GEMINI_API_KEY` and `GEMINI_MODEL`. Gemini is specifically
required for grounded problem-evidence search. Set `AI_PROVIDER=gemini` to prefer it when both providers are configured. Optional `GEMINI_API_KEY_SPARE`
is tried after the primary key fails; add it manually because the current example file does not list it.
`ELEVENLABS_API_KEY` enables microphone transcription. Text input remains the fallback. Optional Anthropic
configuration is described in `.env.example`; do not assume a configured key has usable quota.

The app needs the expected schema and a matching, populated corpus database. An empty database plus the
committed map JSON is not enough to reproduce search. Ask the database owner for an isolated copy of the
validated corpus; use [the corpus release instructions](specs/features/corpus-release/spec.md) for publication.
Do not start a fresh crawl just to run the app.

```sh
node --env-file=.env.local scripts/db-sync.mjs
pnpm dev
```

The first command previews missing schema objects without applying them. For any target other than
`TEST_DATABASE_URL`, it requires a clean checkout exactly at the freshly fetched `origin/main`; it deliberately
refuses a feature branch. For a dedicated test branch, privately set `DATABASE_URL` to the same value as
`TEST_DATABASE_URL` before running the command. Follow the
[database safeguards](specs/tech-stack.md#shared-database-schema-safety-125) before any application of that plan.
Existing schema drift needs investigation, not a forced push. Open the local URL printed by Next.js.

For a production-mode local server, use `pnpm build` followed by `pnpm start`. A successful build alone does not
prove that external providers, schema or the corpus are ready. Never commit environment files or add server
credentials to `NEXT_PUBLIC_*` variables.

## Check and demonstrate

```sh
pnpm typecheck
pnpm lint
pnpm test --maxWorkers=2
```

Browser verification requires Chromium, real test-database credentials and the feature's specified provider
configuration. See the [release runbook](docs/release/README.md) before running tests that create workspace data.

- [Architecture and trust boundaries](docs/release/architecture.md)
- [Original feature coverage and remaining gaps](docs/release/coverage.md)
- [Demo, user trials and submission checklist](docs/release/README.md)

These documents distinguish merged implementation from local, production and human verification. They do not
claim that every feature in the original V3 plan is complete.
