// [verify].command: node scripts/verify.mjs {slug} {out}
// UI features: Playwright runs tests/e2e/<slug>/ against a production build. Corpus features: pytest in corpus/<part>/.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const [slug, out] = process.argv.slice(2);
if (!slug) {
  process.stderr.write("usage: node scripts/verify.mjs <slug> [out]\n");
  process.exit(2);
}

const run = (cmd, args, env = {}) =>
  spawnSync(cmd, args, { stdio: "inherit", env: { ...process.env, ...env } }).status ?? 1;

const e2e = `tests/e2e/${slug}`;
const part = slug.startsWith("corpus-") ? `corpus/${slug.slice("corpus-".length)}` : null;

if (existsSync(e2e)) {
  if (run("pnpm", ["exec", "playwright", "install", "chromium"])) process.exit(1);
  process.exit(run("pnpm", ["exec", "playwright", "test", e2e], out ? { VERIFY_OUT: out } : {}));
}
if (part && existsSync(part)) {
  const venv = `${part}/.venv/bin/python`;
  process.exit(run(existsSync(venv) ? venv : "python3", ["-m", "pytest", part]));
}
process.stderr.write(`verify: no test for ${slug} (expected ${e2e}/${part ? ` or ${part}/` : ""})\n`);
process.exit(1);
