import { defineConfig } from "@playwright/test";

// scripts/verify.mjs sets VERIFY_OUT to a fresh evidence folder; screenshots and traces land there.
const port = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: process.env.VERIFY_OUT ?? "test-results",
  timeout: 30_000,
  use: { baseURL: `http://localhost:${port}`, screenshot: "on", trace: "retain-on-failure" },
  webServer: {
    command: `pnpm build && pnpm start --port ${port}`,
    url: `http://localhost:${port}/api/health`,
    timeout: 240_000,
    reuseExistingServer: false,
  },
});
