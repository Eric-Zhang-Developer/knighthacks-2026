# Tech stack

<!-- Pin choices before the run; new dependencies only through a `contract:` PR. -->

One Next.js app plus one offline Python script. Every sponsor technology here is one we'd pick anyway; sponsor
add-ons sit at the end of `milestones.toml` and must not need changes to the core.

| Layer | Choice |
|---|---|
| Language / framework | TypeScript, Next.js (App Router), pnpm, Node 22. Server code lives in route handlers under `app/api/`: no separate API service |
| Galaxy | three.js through React Three Fiber, all stars in one GPU point buffer (never one component per star), plus a keyboard-accessible list of the same projects |
| Data / database | Neon Postgres with pgvector, through Drizzle. App state and corpus vectors live in the same database. Dev and test use their own Neon branches |
| Corpus | `corpus/`: Python 3.11 script, run offline: fetch → clean → dedupe → embed → UMAP to 3D → load into Neon. Paced fetching, robots.txt respected |
| Embeddings | Hugging Face `BAAI/bge-m3`, dense, normalized. The same model embeds the corpus offline and user ideas at request time (Hugging Face Inference API) |
| Generation | Gemini API via `@google/genai`; the model ID is pinned in one env var. Anthropic Claude via `@anthropic-ai/sdk` is a second provider (`ANTHROPIC_API_KEY`, model in `ANTHROPIC_MODEL`); `lib/ai/` picks one, callers never do |
| Voice | ElevenLabs: realtime speech-to-text and streaming text-to-speech; the server mints a single-use token per session |
| Hosting | Vercel for the app, Neon for data. Use no Vercel-only service (KV, Blob, Edge Config), so the Vultr add-on is a redeploy, not a rewrite |
| Packages (pinned in `package.json`) | next, react, three, @react-three/fiber, drizzle-orm, drizzle-kit, @neondatabase/serverless, @google/genai, @anthropic-ai/sdk, @huggingface/inference, @elevenlabs/react (client speech-to-text), @elevenlabs/elevenlabs-js (server token and TTS), zod, qrcode, vitest, @playwright/test |
| Tests | Vitest (unit), Playwright (verify and end-to-end), pytest (corpus script). Golden test: a committed fixture of real corpus records and the neighbor a fixed query must return |

## Layout
```
app/              pages and app/api/* route handlers
components/       UI: galaxy/, panels/, voice/, ...
lib/              server and shared logic: db.ts, ai/, voice/, search/
db/schema/        one Drizzle schema file per feature: db/schema/<slug>.ts (drizzle config globs the folder)
corpus/           Python pipeline; its fixtures/ hold real records only
public/corpus/    exported star coordinates (JSON)
tests/            vitest; tests/e2e/ for Playwright
```
Frozen (`contract:` only): `AGENTS.md`, `CLAUDE.md`, `.agents/`, `.github/`, `package.json`, `pnpm-lock.yaml`.
The bootstrap feature creates them and installs every dependency the table names. A feature that needs another
dependency opens a `contract:` PR changing this table and `package.json` together.
Schema changes go through `drizzle-kit push`, with no migration files: demo data is disposable.

## Checks (run before marking a PR ready)
<!-- Keep CI under ~5 minutes: a slow CI caps how fast every agent can merge. Docs-only changes can skip heavy jobs. -->
```bash
python3 .agents/scripts/check_ownership.py --lint-specs
python3 .agents/scripts/check_ownership.py --title "<PR title>" --base origin/main
python3 .agents/scripts/check_gates.py --title "<PR title>" --base origin/main
python3 .agents/scripts/check_markers.py --base origin/main
pnpm typecheck && pnpm lint && pnpm test      # the bootstrap feature adds these and wires them into ci.yml
```

## Verify (see your change running)
The bootstrap feature sets `[verify].command` to a Playwright run against `next build && next start` on the test
Neon branch. It saves screenshots and responses to `{out}` and fails on a wrong result, not only a crash.
Agents run it as `python3 .agents/scripts/verify.py --slug <slug> --worktree .` and paste its last line into the
done note.
