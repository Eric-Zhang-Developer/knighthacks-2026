import { test, expect } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
const run = promisify(execFile);
test.use({ trace: "off" });
test("actual app rejects oversized text and malformed JSON without a provider call", async ({ request, baseURL }, info) => {
  if (!baseURL) throw new Error("Playwright baseURL required");
  const headers = { origin: new URL(baseURL).origin, "content-type": "application/json" };
  const responses = [];
  for (const data of [JSON.stringify({ text: "😀".repeat(201) }), "{"]) {
    const response = await request.post("/api/speech", { headers, data });
    expect(response.status()).toBe(400);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(typeof (await response.json()).error).toBe("string");
    responses.push({ status: response.status(), headers: { "content-type": response.headers()["content-type"], "cache-control": response.headers()["cache-control"] } });
  }
  await writeFile(info.outputPath("http-validation.json"), JSON.stringify({ mode: "real app HTTP validation; no provider call", responses }, null, 2));
});
test("isolated actual route streams mocked bytes and sanitizes provider outage", async ({}, info) => {
  const { stdout } = await run(process.execPath, [join(__dirname, "runner.mjs")], { timeout: 15000, env: process.env });
  const evidence = JSON.parse(stdout);
  expect(evidence.results.map((r: { status: number }) => r.status)).toEqual([200, 503]);
  const body = JSON.stringify(evidence, null, 2);
  await writeFile(info.outputPath("sdk-mocked-responses.json"), body);
  await info.attach("sdk-mocked-response-headers", { body, contentType: "application/json" });
});

test("opt-in live provider returns audio through the real app HTTP route", async ({ request, baseURL }, info) => {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  test.skip(process.env.UNCHARTED_VERIFY_LIVE_SPEECH !== "1", "Live synthesis requires explicit UNCHARTED_VERIFY_LIVE_SPEECH=1 authorization.");
  test.skip(!key, "Live synthesis requires ELEVENLABS_API_KEY in the verifier process environment.");
  if (!baseURL || !key) throw new Error("Live speech verifier configuration missing");
  test.setTimeout(45000);
  const response = await request.post("/api/speech", {
    headers: { origin: new URL(baseURL).origin },
    data: { text: "Uncharted speech verification." },
    timeout: 40000,
  });
  const bytes = await response.body();
  const headers = response.headers();
  // Boolean checks intentionally avoid including the secret in assertion output.
  expect(JSON.stringify(headers).includes(key), "Response headers must not expose the API key").toBe(false);
  expect(bytes.includes(Buffer.from(key)), "Response body must not expose the API key").toBe(false);
  expect(response.status()).toBe(200);
  expect(headers["content-type"]).toBe("audio/mpeg");
  expect(headers["cache-control"]).toBe("no-store");
  expect(bytes.byteLength).toBeGreaterThan(0);
  const evidence = JSON.stringify({
    mode: "live provider through real app HTTP; no playback assessment",
    status: response.status(),
    headers,
    byteCount: bytes.byteLength,
  }, null, 2);
  await writeFile(info.outputPath("live-http-response.json"), evidence);
  await info.attach("live-speech-response-metadata", { body: evidence, contentType: "application/json" });
});
