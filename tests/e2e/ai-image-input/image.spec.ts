import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

// ai-image-input Validation 4: the owned client reads a synthetic, legible brief image with every configured
// provider on its own (or the fixture when none is configured). A provider that can't read it fails the check: a
// missing capability is a blocker to report, not a pass.
test.use({ trace: "off" });
test("each configured provider transcribes the synthetic brief image on its own", async ({}, info) => {
  test.setTimeout(300000);
  const { stdout } = await promisify(execFile)(process.execPath, [join(__dirname, "runner.mjs")], { timeout: 290000, env: process.env });
  const result = JSON.parse(stdout) as { mode: string; results: { provider: string; code?: string; legibility?: string; transcript?: string }[] };
  const body = JSON.stringify(result, null, 2);
  await writeFile(info.outputPath("ai-image-input.json"), body);
  await info.attach("ai-image-input", { body, contentType: "application/json" });
  expect(result.results.length).toBeGreaterThan(0);
  for (const r of result.results) {
    expect(r.code, `${r.provider} failed`).toBeUndefined();
    expect(r.legibility).toBe("full");
    // Facts only the image carries: the prize, the track and a requirement.
    expect(r.transcript).toMatch(/\$750/);
    expect(r.transcript).toMatch(/Open Transit Data/i);
    expect(r.transcript).toMatch(/phone-sized screen/i);
  }
});
