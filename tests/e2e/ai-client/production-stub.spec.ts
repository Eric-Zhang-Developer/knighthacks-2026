import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test.use({ trace: "off" });
test("production Next AI fixtures require explicit local opt-in and reject Vercel", async ({}, info) => {
  test.setTimeout(300000);
  // The harness builds a real Next app importing the unchanged server-only source.
  const result = await promisify(execFile)(process.execPath, [join(__dirname, "production-stub.mjs")], {
    timeout: 290000, windowsHide: true,
  }).catch((error: { stdout?: string }) => ({ stdout: error.stdout ?? "" }));
  const observations = JSON.parse(result.stdout);
  const body = JSON.stringify(observations, null, 2);
  await writeFile(info.outputPath("production-stub.json"), body);
  await info.attach("production-stub", { body, contentType: "application/json" });
  expect(observations.allowed).toEqual({ status: 200, production: true, fixtureMatches: true, unavailable: false });
  for (const denied of [observations.unapproved, observations.deployed]) {
    expect(denied).toEqual({ status: 503, production: true, fixtureMatches: false, unavailable: true });
  }
});
