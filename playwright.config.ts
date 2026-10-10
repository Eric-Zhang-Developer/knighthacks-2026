import { defineConfig } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

// The verifier assigns one identity before workers start. Direct Playwright
// invocations allocate once here and propagate it to the app and workers too.
if (!process.env.UNCHARTED_VERIFY_PORT || !process.env.UNCHARTED_VERIFY_TOKEN) {
  const identity = JSON.parse(execFileSync(process.execPath, [join(__dirname, "scripts/verify-server.mjs")], { encoding: "utf8", windowsHide: true }));
  process.env.UNCHARTED_VERIFY_PORT = String(identity.port);
  process.env.UNCHARTED_VERIFY_TOKEN = identity.token;
}
const port = Number(process.env.UNCHARTED_VERIFY_PORT);
const token = process.env.UNCHARTED_VERIFY_TOKEN;
if (!Number.isInteger(port) || port < 1 || port > 65535 || !token || !/^[a-f0-9]{48}$/.test(token)) {
  throw new Error("Invalid verifier port or readiness identity");
}

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: process.env.VERIFY_OUT ?? "test-results",
  timeout: 30_000,
  // NextRequest canonicalizes loopback URLs to localhost; Origin must match it.
  use: { baseURL: `http://localhost:${port}`, screenshot: "on", trace: "retain-on-failure" },
  webServer: {
    command: `pnpm build && pnpm start --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}/api/health/verify/${token}`,
    timeout: 240_000,
    reuseExistingServer: false,
  },
});
