import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, test } from "vitest";

test("actual Next config ignores ancestor lockfiles without weakening standalone output", () => {
  const dependencies = join(process.cwd(), "node_modules");
  const output = execFileSync(process.execPath, [join(process.cwd(), "tests/build-root/load-config.mjs"), join(process.cwd(), "next.config.ts"), dependencies], {
    encoding: "utf8", windowsHide: true, timeout: 25000,
    env: { ...process.env, NODE_PATH: dependencies, NODE_ENV: "production", GIT_COMMIT: "build-root-regression", VERCEL_GIT_COMMIT_SHA: "", NEXT_TELEMETRY_DISABLED: "1" },
  });
  expect(output).toContain("PASS: actual Next config stays rooted at its app directory");
}, 30000);
