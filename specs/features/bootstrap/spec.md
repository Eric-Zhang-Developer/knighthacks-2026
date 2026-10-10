---
name: Next.js app shell, database, checks and verifier that every feature builds on
depends_on: []
owns: []
assignee: ""
bootstrap: true
---

# Bootstrap

## Plan
1. `create-next-app` (TypeScript, App Router, ESLint), pnpm, Node 22. Install every dependency
   `specs/tech-stack.md` names, plus zod, drizzle-kit, vitest and @playwright/test; list anything else you add in
   the tech-stack table in this PR.
2. `lib/db.ts`: Drizzle over `@neondatabase/serverless`; `drizzle.config.ts` globs `db/schema/*.ts`; enable the
   `vector` extension.
3. `lib/store.ts`: one small client store holding `selectedProjectId`, `highlightedIds`, `ideaStars`,
   `activeIdeaVersionId`, `ideaDraft`. Features share state through it.
4. `app/page.tsx`: the layout from the plan doc. Search on top, galaxy in the centre, a right column of panels,
   voice bar at the bottom. It imports `components/<area>/index.tsx` for search, galaxy, drawer, explainer, idea,
   evidence, revisions, challenge, voice, branches, compare, votes, snapshot and share. Create each as a stub
   returning `null`, so later features edit only their own folder.
5. `app/api/health/route.ts` returns `{"commit": "<git sha>"}`.
6. `package.json` scripts `typecheck`, `lint`, `test` (vitest); wire them into `ci.yml`'s Project checks.
7. `scripts/verify.mjs {slug} {out}`: if `tests/e2e/<slug>/` exists, run it with Playwright against
   `next build && next start`, saving screenshots and responses to `{out}`. If `corpus/<part>/` matches a
   `corpus-<part>` slug, run its pytest. Fail when there is no test for the slug. Set `[verify].command` in
   `.agents/config.toml` to `node scripts/verify.mjs {slug} {out}`.
8. `.env.example` lists every variable: `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `HF_TOKEN`,
   `EMBED_MODEL`, `ELEVENLABS_API_KEY`. `.gitignore` keeps `.env*` (except the example) and `corpus/data/` out.

## Requirements
- `pnpm typecheck && pnpm lint && pnpm test` pass on a clean clone, and CI runs them.
- `GET /api/health` returns 200 and JSON with the current commit.
- The home page renders the empty layout with no console errors, and says "corpus not loaded" where the galaxy
  goes until `public/corpus/stars.json` exists.
- No secret is read in client code; only `NEXT_PUBLIC_*` variables reach the browser, and there are none.

## Validation
1. `pnpm build && pnpm start`, then `curl localhost:3000/api/health` -> `{"commit":"<sha>"}`.
2. Open `/` -> the four regions render and the galaxy area says "corpus not loaded".
3. `python3 .agents/scripts/verify.py --slug bootstrap --worktree .` -> pass (`tests/e2e/bootstrap/` covers 1 and 2).
Keep: the health response and a screenshot of `/`.

## Defaults
Prefer framework defaults over custom config. Don't build feature UI beyond the stubs.
