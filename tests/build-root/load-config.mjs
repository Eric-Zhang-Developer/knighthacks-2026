import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";

const [source, dependencies] = process.argv.slice(2);
const root = mkdtempSync(join(tmpdir(), "uncharted-build-root-"));
const app = join(root, "app");
const require = createRequire(import.meta.url);
try {
  mkdirSync(app);
  writeFileSync(join(root, "package-lock.json"), JSON.stringify({ name: "unrelated-ancestor", lockfileVersion: 3 }));
  writeFileSync(join(app, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  writeFileSync(join(app, "package.json"), JSON.stringify({ name: "tracing-root-test", private: true }));
  copyFileSync(source, join(app, "next.config.ts"));
  // Cwd intentionally differs from the config directory: process.cwd() is not an equivalent fix.
  process.chdir(root);
  const loadConfig = require(join(dependencies, "next/dist/server/config.js")).default;
  const { PHASE_PRODUCTION_BUILD } = require(join(dependencies, "next/constants.js"));
  const config = await loadConfig(PHASE_PRODUCTION_BUILD, app);
  assert.equal(config.outputFileTracingRoot, app, "Ancestor lockfiles must not expand the tracing root");
  assert.equal(config.output, "standalone", "The full deployable standalone output remains enabled");
  assert.equal(config.env.GIT_COMMIT, "build-root-regression", "Health commit configuration is preserved");
  process.stdout.write("PASS: actual Next config stays rooted at its app directory with standalone output\n");
} finally {
  process.chdir(tmpdir());
  // Only remove the fresh OS-temp tree created above; it contains no junctions or dependency copies.
  if (dirname(resolve(root)) !== resolve(tmpdir()) || !basename(root).startsWith("uncharted-build-root-")) throw new Error("Unexpected temporary root");
  rmSync(root, { recursive: true, force: true });
}
