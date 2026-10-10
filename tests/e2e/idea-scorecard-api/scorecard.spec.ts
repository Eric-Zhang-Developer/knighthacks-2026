import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

// Real sessions, saves (real embeddings) and Neon test branch; generation (evidence cards and the scorecard) reads
// fixtures from AI_STUB_DIR (a fresh absolute directory, AI_STUB_ALLOW=1). Rows are kept. Traces would hold cookies.
test.use({ trace: "off" });
const fields = { title: "Team meal planner", description: "Help hackathon teams plan shared meals.", audience: "Hackathon teammates",
  problem: "Coordinating meals while building together", workflow: "Collect each teammate's dietary constraints, then choose a shared meal", constraints: null };
const point = (text: string, sourceIds: string[] = [], label = "supported") => ({ text, label, sourceIds });
const KEYS = ["originality", "technicalUnderstanding", "functionality", "design", "wowFactor"];
const NAMES = ["Originality", "Technical Understanding", "Functionality", "Design", "Wow Factor"];

test("five criteria scored 1-5 with points for and against, grounded in the real neighbours; insert-only; GET reads the newest", async ({ playwright, baseURL }) => {
  test.setTimeout(180_000);
  const stub = process.env.AI_STUB_DIR;
  expect(Boolean(stub) && isAbsolute(stub!), "Start the server with a fresh absolute AI_STUB_DIR").toBe(true);
  expect(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL, "App and verifier must both use the test branch").toBe(true);
  const sql = neon(process.env.TEST_DATABASE_URL!);
  const origin = new URL(baseURL!).origin, headers = { origin };
  const [owner, stranger, anonymous] = await Promise.all([0, 1, 2].map(() => playwright.request.newContext({ baseURL: origin })));
  for (const c of [owner, stranger]) expect((await c.post("/api/workspace", { headers })).status()).toBe(201);
  const saved = await (await owner.post("/api/ideas", { headers: { ...headers, "Idempotency-Key": randomUUID() }, data: fields })).json() as { versionId: string; neighborIds: string[] };
  const v = saved.versionId, [n1, n2] = saved.neighborIds;
  // Evidence for the neighbours the scorecard may cite (generated first, as snapshots do): nothing claimed.
  for (const id of saved.neighborIds)
    await writeFile(join(stub!, `evidence-${id}.json`), JSON.stringify({ overlaps: [], differences: [], uncertainty: point("Not stated on the page", [], "unverified") }));
  const scorecard = (overrides: Record<string, unknown> = {}) => writeFile(join(stub!, `scorecard-${v}.json`), JSON.stringify({
    ...Object.fromEntries(KEYS.map((k, i) => [k, { score: i + 1, for: [point(`${k} strength`, [n1])], against: [point(`${k} weakness`)] }])),
    originality: { score: 4, for: [point("Unlike its nearest neighbour, it decides for a whole team", [n1, "invented-id"]), point("Nothing sits nearby on the map")],
      against: [point("A neighbour already collects dietary limits", [n2])] }, ...overrides }));
  const rows = async () => (await sql`select count(*)::int as n from scorecards where version_id = ${v}::uuid`)[0].n;

  expect((await owner.get(`/api/scorecard/${v}`)).status()).toBe(404);
  await scorecard();
  const res = await owner.post(`/api/scorecard/${v}`, { headers });
  expect(res.status()).toBe(200);
  const card = await res.json();
  expect(Object.keys(card).sort()).toEqual(["createdAt", "criteria", "id", "sources", "versionId"]);
  expect(card).not.toHaveProperty("total");
  expect(card.criteria.map((c: { criterion: string }) => c.criterion)).toEqual(NAMES);
  for (const c of card.criteria) {
    expect(c.score).toBeGreaterThanOrEqual(1);
    expect(c.score).toBeLessThanOrEqual(5);
    expect(c.for.length).toBeGreaterThan(0);
    expect(c.against.length).toBeGreaterThan(0);
  }
  const [orig] = card.criteria;
  expect(orig.for).toEqual([point("Unlike its nearest neighbour, it decides for a whole team", [n1])]); // map-space point dropped, invented id removed
  expect(orig.label).toBe("supported");
  expect(card.criteria[1].against[0]).toEqual(point("technicalUnderstanding weakness", [], "inferred"));
  expect(card.criteria[1].label).toBe("inferred");
  expect(card.sources.map((s: { projectId: string }) => s.projectId)).toEqual(expect.arrayContaining([n1, n2]));
  expect(await (await owner.get(`/api/scorecard/${v}`)).json()).toEqual(card);

  // Insert-only: a second POST adds a row; thin evidence reads as null with the reason, and GET returns the newest.
  await scorecard({ design: { score: 3, for: [], against: [point("Hard to judge from a plan")] } });
  const second = await (await owner.post(`/api/scorecard/${v}`, { headers })).json();
  expect(second.id).not.toBe(card.id);
  expect(second.criteria[3]).toMatchObject({ criterion: "Design", score: null, note: "evidence is insufficient" });
  expect(await rows()).toBe(2);
  expect((await (await owner.get(`/api/scorecard/${v}`)).json()).id).toBe(second.id);

  // A provider failure (a criterion missing, twice) -> 502 and nothing stored; other workspaces, no session, cross-origin.
  await writeFile(join(stub!, `scorecard-${v}.json`), JSON.stringify({ originality: { score: 3, for: [], against: [] } }));
  expect((await owner.post(`/api/scorecard/${v}`, { headers })).status()).toBe(502);
  expect(await rows()).toBe(2);
  expect((await stranger.post(`/api/scorecard/${v}`, { headers })).status()).toBe(404);
  expect((await stranger.get(`/api/scorecard/${v}`)).status()).toBe(404);
  expect((await anonymous.post(`/api/scorecard/${v}`, { headers })).status()).toBe(401);
  expect((await owner.post(`/api/scorecard/${v}`, { headers: { origin: "https://evil.example" } })).status()).toBe(403);
  expect((await owner.get("/api/scorecard/not-a-uuid")).status()).toBe(404);
});
