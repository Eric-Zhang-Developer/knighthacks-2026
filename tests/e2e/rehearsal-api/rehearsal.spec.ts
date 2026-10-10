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
const built = ["voice search for recipes", "a shared meal list"];
const claim = (text: string, label: string) => ({ text, label, sourceIds: [] as string[] });
const q = (n: number, basis = claim(workflow, "supported")) => ({ question: `Question ${n}: what happens offline?`, weakness: "Needs a network", basis });

test("built sentences quote a built item, unlisted 'working' claims are planned, stored once; two questions fail", async ({ playwright, baseURL }) => {
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
  const fixture = (versionId: string, body: unknown) => writeFile(join(stub!, `rehearsal-${versionId}.json`), JSON.stringify(body));
  const rows = async (versionId: string) => (await sql`select count(*)::int as n from rehearsals where version_id = ${versionId}::uuid`)[0].n;
  const post = (c: APIRequestContext, v: string, data: unknown = { built }) => c.post(`/api/rehearsal/${v}`, { headers, data });

  // 1 + 2. Two built items. One sentence quotes an item; one calls an unlisted feature working and is labelled built.
  const v1 = await save(owner);
  expect((await owner.get(`/api/rehearsal/${v1}`)).status()).toBe(404);
  await fixture(v1, { pitch: [
    { text: "Ask for dinner and voice search for recipes finds one everyone can eat.", status: "built" },
    { text: "Payments between teammates already work.", status: "built" },
    { text: "Next we will add grocery delivery.", status: "planned" },
  ], questions: [q(1), q(2, claim("a shared meal list", "supported")), q(3, claim("Judges prefer live demos", "supported"))] });
  const first = await post(owner, v1);
  expect(first.status()).toBe(200);
  const r = await first.json();
  expect(Object.keys(r).sort()).toEqual(["built", "pitch", "questions", "versionId"]);
  expect(r.built).toEqual(built);
  expect(r.pitch.map((s: { status: string }) => s.status)).toEqual(["built", "planned", "planned"]);
  for (const s of r.pitch.filter((x: { status: string }) => x.status === "built")) expect(built.some((b) => s.text.includes(b))).toBe(true);
  expect(r.questions).toHaveLength(3);
  expect(r.questions.map((x: { basis: unknown }) => x.basis)).toEqual([
    { text: workflow, label: "supported", sourceIds: [v1] },
    { text: "a shared meal list", label: "supported", sourceIds: [v1] },
    { text: "Judges prefer live demos", label: "inferred", sourceIds: [] },
  ]);

  // Same POST again (items in another order): the stored row, no model call (the fixture is gone); GET returns it.
  await unlink(join(stub!, `rehearsal-${v1}.json`));
  const again = await post(owner, v1, { built: [...built].reverse() });
  expect(again.status()).toBe(200);
  expect(await again.json()).toEqual(r);
  expect(await (await owner.get(`/api/rehearsal/${v1}`)).json()).toEqual(r);
  expect(await rows(v1)).toBe(1);

  // 3. A fixture with two questions: generate() regenerates once (pinned in tests/ai-client), then 502, nothing stored.
  const v2 = await save(owner);
  await fixture(v2, { pitch: [{ text: "Try voice search for recipes.", status: "built" }], questions: [q(1), q(2)] });
  const two = await post(owner, v2);
  expect(two.status()).toBe(502);
  expect(await rows(v2)).toBe(0);

  // Bad bodies, other workspaces, no session, cross-origin.
  expect((await post(owner, v1, { built: [] })).status()).toBe(400);
  expect((await post(owner, v1, { built: ["x".repeat(121)] })).status()).toBe(400);
  expect((await post(owner, v1, { built: Array(9).fill("x") })).status()).toBe(400);
  expect((await post(stranger, v1)).status()).toBe(404);
  expect((await stranger.get(`/api/rehearsal/${v1}`)).status()).toBe(404);
  expect((await post(anonymous, v1)).status()).toBe(401);
  expect((await owner.post(`/api/rehearsal/${v1}`, { headers: { origin: "https://evil.example" }, data: { built } })).status()).toBe(403);
  expect((await owner.get("/api/rehearsal/not-a-uuid")).status()).toBe(404);
});
