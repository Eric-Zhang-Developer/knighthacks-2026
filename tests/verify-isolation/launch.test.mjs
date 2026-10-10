import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const preload = new URL("./pnpm-probe.mjs", import.meta.url).href;
async function launch() {
  const env = { ...process.env };
  delete env.UNCHARTED_VERIFY_PORT; delete env.UNCHARTED_VERIFY_TOKEN; delete env.NODE_OPTIONS;
  const { stdout } = await promisify(execFile)(process.execPath, ["--import", preload, "scripts/verify.mjs", "bootstrap"], { cwd: root, env, windowsHide: true });
  return JSON.parse(stdout);
}
test("simultaneous actual verifier invocations assign distinct ports and readiness identities", async () => {
  const [a, b] = await Promise.all([launch(), launch()]);
  assert.ok(Number(a.port) > 0 && Number(b.port) > 0, "each verifier must assign its own port, not defer to shared3100");
  assert.notEqual(a.port, b.port, "simultaneous verifiers must use different ports");
  assert.ok(typeof a.token === "string" && a.token.length >= 32 && typeof b.token === "string" && b.token.length >= 32, "each verifier must propagate a readiness identity");
  assert.ok(a.token !== b.token, "readiness identities must differ");
});
