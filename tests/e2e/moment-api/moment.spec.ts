import { neon } from "@neondatabase/serverless";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

// Real sessions, saves (real embeddings) and Neon test branch; generation reads per-version fixtures from AI_STUB_DIR
// (a fresh absolute directory, AI_STUB_ALLOW=1). Stored rows are kept. Traces would hold session cookies.
test.use({ trace: "off" });
const workflow = "Collect each teammate's dietary constraints, then choose a shared meal";
const fields = { title: "Team meal planner", description: "Help hackathon teams plan shared meals.", audience: "Hackathon teammates",
  problem: "Coordinating meals while building together", workflow, constraints: null };
const claim = (text: string, label: string) => ({ text, label, sourceIds: [] as string[] });
const step = (n: number, demonstrates = claim("choose a shared meal", "supported")) =>
  ({ judgeDoes: `Step ${n}: the judge enters two dietary limits`, appears: "One meal both teammates can eat", demonstrates });

test("three complete steps stored once; incomplete drafts fail; unquoted supported claims are downgraded", async ({ playwright, baseURL }, info) => {
  test.setTimeout(180_000);
  const stub = process.env.AI_STUB_DIR;
  expect(Boolean(stub) && isAbsolute(stub!), "Start the server with a fresh absolute AI_STUB_DIR").toBe(true);
  expect(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL, "App and verifier must both use the test branch").toBe(true);
  const sql = neon(process.env.TEST_DATABASE_URL!);
  const origin = new URL(baseURL!).origin, headers = { origin };
  const [owner, stranger, anonymous] = await Promise.all([0, 1, 2].map(() => playwright.request.newContext({ baseURL: origin })));
  for (const c of [owner, stranger]) expect((await c.post("/api/workspace", { headers })).status()).toBe(201);
  const save = async (c: APIRequestContext) =>
    (await (await c.post("/api/ideas", { headers: { ...headers, "Idempotency-Key": randomUUID() }, data: fields })).json()).versionId as string;
  const fixture = (versionId: string, body: unknown) => writeFile(join(stub!, `moment-${versionId}.json`), JSON.stringify(body));
  const rows = async (versionId: string) => (await sql`select count(*)::int as n from moments where version_id = ${versionId}::uuid`)[0].n;

  // 1. Three complete steps; a second POST returns the stored row without a model call (the fixture is gone).
  const v1 = await save(owner);
  await fixture(v1, { steps: [step(1), step(2), step(3)], basis: [claim(workflow, "supported"), claim("Teams eat sooner", "inferred")] });
  const first = await owner.post(`/api/moment/${v1}`, { headers });
  expect(first.status()).toBe(200);
  const moment = await first.json();
  expect(Object.keys(moment).sort()).toEqual(["basis", "steps", "versionId"]);
  expect(moment.steps).toHaveLength(3);
  for (const s of moment.steps) {
    expect(Object.keys(s).sort()).toEqual(["appears", "demonstrates", "judgeDoes"]);
    expect(s.demonstrates).toEqual({ text: "choose a shared meal", label: "supported", sourceIds: [v1] });
  }
  expect(moment.basis[0]).toEqual({ text: workflow, label: "supported", sourceIds: [v1] });
  await unlink(join(stub!, `moment-${v1}.json`));
  const again = await owner.post(`/api/moment/${v1}`, { headers });
  expect(again.status(), "a stored moment needs no model call").toBe(200);
  expect(await again.json()).toEqual(moment);
  expect(await (await owner.get(`/api/moment/${v1}`)).json()).toEqual(moment);
  expect(await rows(v1)).toBe(1);

  // 2. Two steps, or a step missing `demonstrates`: rejected, retried once, then 502 with nothing stored.
  for (const steps of [[step(1), step(2)], [step(1), step(2), { judgeDoes: "Opens the planner", appears: "A meal" }]]) {
    const v = await save(owner);
    await fixture(v, { steps, basis: [claim(workflow, "supported")] });
    expect((await owner.post(`/api/moment/${v}`, { headers })).status()).toBe(502);
    expect(await rows(v)).toBe(0);
    expect((await owner.get(`/api/moment/${v}`)).status()).toBe(404);
  }

  // A `supported` claim naming a capability the version never states is downgraded to `inferred`.
  const v2 = await save(owner);
  const invented = claim("Places the order through DoorDash automatically", "supported");
  await fixture(v2, { steps: [step(1), step(2), step(3, invented)], basis: [invented] });
  const downgraded = await (await owner.post(`/api/moment/${v2}`, { headers })).json();
  expect(downgraded.steps[2].demonstrates).toEqual({ ...invented, label: "inferred" });
  expect(downgraded.basis[0].label).toBe("inferred");

  // Workspace, session and origin rules.
  expect((await stranger.post(`/api/moment/${v1}`, { headers })).status()).toBe(404);
  expect((await stranger.get(`/api/moment/${v1}`)).status()).toBe(404);
  expect((await anonymous.get(`/api/moment/${v1}`)).status()).toBe(401);
  expect((await owner.post(`/api/moment/${v1}`, { headers: { origin: "https://evil.test" } })).status()).toBe(403);

  await writeFile(info.outputPath("moments.json"), JSON.stringify({ moment, downgraded }, null, 2));
  await Promise.all([owner, stranger, anonymous].map((c) => c.dispose()));
});
