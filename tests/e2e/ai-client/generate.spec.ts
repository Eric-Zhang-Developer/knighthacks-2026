import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
const run = promisify(execFile);
test.use({ trace: "off" });
test("server client returns schema-validated live or explicitly stubbed JSON", async ({}, info) => {
  // Sequential retries allow 2 x 60s for Claude + 2 x 30s for Gemini, plus startup/reporting time.
  test.setTimeout(210000);
  const { stdout } = await run(process.execPath, [join(__dirname, "runner.mjs")], { timeout: 200000, env: process.env });
  const result = JSON.parse(stdout);
  expect(["live", "stub"]).toContain(result.mode);
  if (result.mode === "stub") expect(result).toEqual({ mode: "stub", model: null, data: { message: "AI client fixture verified" } });
  else {
    expect(result.results.length).toBeGreaterThan(0);
    for (const r of result.results) { expect(r.model).toBeTruthy(); expect(typeof r.data.message).toBe("string"); }
  }
  const body = JSON.stringify(result, null, 2);
  await writeFile(info.outputPath("ai-client-response.json"), body); // attach() alone stays in the report, not the evidence folder
  await info.attach("ai-client-response", { body, contentType: "application/json" });
});
