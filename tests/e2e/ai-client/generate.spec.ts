import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
const run = promisify(execFile);
test.use({ trace: "off" });
test("server client returns schema-validated live or explicitly stubbed JSON", async ({}, info) => {
  test.setTimeout(75000);
  const { stdout } = await run(process.execPath, [join(__dirname, "runner.mjs")], { timeout: 70000, env: process.env });
  const result = JSON.parse(stdout);
  expect(["live", "stub"]).toContain(result.mode);
  expect(typeof result.data.message).toBe("string");
  if (result.mode === "stub") expect(result).toEqual({ mode: "stub", model: null, data: { message: "AI client fixture verified" } });
  else expect(result.model).toBeTruthy();
  await info.attach("ai-client-response", { body: JSON.stringify(result, null, 2), contentType: "application/json" });
});
