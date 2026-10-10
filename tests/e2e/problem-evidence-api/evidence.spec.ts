import { expect, test } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { spawn, execFileSync } from "node:child_process";
import type { Grounded } from "@/lib/ai/grounded";
import type { Evidence } from "@/lib/problem-evidence/contract";
test.use({ trace: "off" });
const statement = "The fixture reports a problem in March 2025.";
const undated = "The fixture describes an ongoing problem.";
// Synthetic grounding fixtures exercise provenance; they are not factual corpus records.
const grounded = { model: "fixture-model", text: `${statement} ${undated} This sentence has no support.`,
  groundingChunks: [{ uri: "https://example.org/report", title: "Fixture report" }],
  groundingSupports: [{ text: statement, chunkIndices: [0] }, { text: undated, chunkIndices: [0] }] };

test("grounded evidence is immutable, scoped, dated only from sources, and fails closed", async ({ playwright, baseURL }, info) => {
  test.setTimeout(240000);
  expect(process.env.DATABASE_URL).toBe(process.env.TEST_DATABASE_URL);
  const sql = neon(process.env.TEST_DATABASE_URL!);
  const origin = new URL(baseURL!).origin, headers = { origin };
  const owner = await playwright.request.newContext({ baseURL: origin });
  const stranger = await playwright.request.newContext({ baseURL: origin });
  const anonymous = await playwright.request.newContext({ baseURL: origin });
  for (const context of [owner, stranger]) expect((await context.post("/api/workspace", { headers })).status()).toBe(201);
  const save = async (problem: string | null) => {
    const response = await owner.post("/api/ideas", { headers: { ...headers, "Idempotency-Key": randomUUID() }, data: {
      title: "Food waste measurement", description: "Help households measure and reduce wasted food", problem,
      audience: "Households", workflow: "Record discarded food and review weekly totals", constraints: null } });
    expect(response.status()).toBe(201); return (await response.json()).versionId as string;
  };
  const problem = "Households waste food and struggle to measure how much is discarded";
  const id = await save(problem);
  const live = process.env.EVIDENCE_LIVE === "1";
  const stub = process.env.AI_STUB_DIR!;
  const keys = [`grounded-${id}`, `evidence-classify-${id}`, `evidence-pages-${id}`];
  if (!live) {
    expect(process.env.AI_STUB_ALLOW).toBe("1"); expect(stub).toBeTruthy();
    await writeFile(join(stub, `${keys[0]}.json`), JSON.stringify(grounded));
    await writeFile(join(stub, `${keys[1]}.json`), JSON.stringify({ items: [0, 1].map((s) => ({ id: `s${s}-c0`, about: "problem", relevance: "This may indicate a need for measurement." })) }));
    await writeFile(join(stub, `${keys[2]}.json`), JSON.stringify({ "https://example.org/report": { url: "https://example.org/report", html: "<html><p>No publication date</p></html>" } }));
  }
  const response = await owner.post(`/api/problem-evidence/${id}`, { headers, timeout: 120000 });
  expect(response.status()).toBe(200);
  const evidence = await response.json() as Evidence;
  expect(evidence.items.some((item) => item.about === "problem")).toBe(true);
  const rows = await sql`select data, grounding from problem_evidence where version_id=${id}::uuid`;
  expect(rows).toHaveLength(1);
  const receipt = rows[0].grounding as Grounded;
  for (const item of evidence.items) {
    expect(receipt.groundingSupports.some((s) => s.text === item.claim.text && s.chunkIndices.length)).toBe(true);
    expect(item.claim.label).toBe("supported"); expect(item.relevance.label).toBe("inferred"); expect(item.source.domain).toBeTruthy();
  }
  if (!live) {
    expect(evidence.items.map((i) => i.claim.text)).toEqual([statement, undated]);
    expect(evidence.items.map((i) => i.eventDate)).toEqual(["March 2025", null]);
    expect(evidence.items.every((i) => i.publishedAt === null)).toBe(true);
    await Promise.all(keys.map((key) => unlink(join(stub, `${key}.json`))));
  }
  expect(await (await owner.post(`/api/problem-evidence/${id}`, { headers })).json()).toEqual(evidence);
  expect(await (await owner.get(`/api/problem-evidence/${id}`)).json()).toEqual(evidence);
  expect((await stranger.get(`/api/problem-evidence/${id}`)).status()).toBe(404);
  expect((await stranger.post(`/api/problem-evidence/${id}`, { headers })).status()).toBe(404);
  expect((await anonymous.get(`/api/problem-evidence/${id}`)).status()).toBe(401);
  expect((await owner.post(`/api/problem-evidence/${id}`, { headers: { origin: "https://evil.test" } })).status()).toBe(403);
  const noProblem = await save(null);
  expect((await owner.post(`/api/problem-evidence/${noProblem}`, { headers })).status()).toBe(422);
  // A second actual production server has no Gemini key or stubs. It shares only the TEST database.
  const missingKeyId = await save(problem);
  const freshEnv = { ...process.env };
  delete freshEnv.UNCHARTED_VERIFY_PORT; delete freshEnv.UNCHARTED_VERIFY_TOKEN;
  const identity = JSON.parse(execFileSync(process.execPath, ["scripts/verify-server.mjs"], { encoding: "utf8", env: freshEnv }));
  const env = { ...process.env, GEMINI_API_KEY: "", AI_STUB_DIR: "", UNCHARTED_VERIFY_PORT: String(identity.port), UNCHARTED_VERIFY_TOKEN: identity.token };
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(identity.port)], { env, stdio: "ignore" });
  const ended = new Promise((resolve) => server.once("exit", resolve));
  const secondOrigin = `http://localhost:${identity.port}`;
  const missing = await playwright.request.newContext({ baseURL: secondOrigin, storageState: await owner.storageState() });
  try {
    await expect.poll(async () => { try { return (await missing.get(`/api/health/verify/${identity.token}`)).status(); } catch { return 0; } }, { timeout: 30000 }).toBe(200);
    expect((await missing.post(`/api/problem-evidence/${missingKeyId}`, { headers: { origin: secondOrigin } })).status()).toBe(503);
    expect((await sql`select version_id from problem_evidence where version_id=${missingKeyId}::uuid`)).toHaveLength(0);
  } finally { server.kill(); await ended; await missing.dispose(); }
  await writeFile(info.outputPath("evidence.json"), JSON.stringify({ evidence, grounding: receipt, mode: live ? "live" : "fixture", retainedVersionId: id }, null, 2));
  await Promise.all([owner, stranger, anonymous].map((c) => c.dispose()));
});
