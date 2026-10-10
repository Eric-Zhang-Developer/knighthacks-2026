import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import fixture from "./fixtures/branch-suggest.json";
// Fictional test idea/directions only; real HTTP, HF embeddings and dedicated Neon test data. Keep rows; no cookie traces.
test.use({ trace: "off" });
const fields = { title: "Hackathon meal planning", description: "Help teams plan meals around dietary constraints.",
  audience: "Hackathon teammates", problem: "Coordinating meals while building", workflow: "Choose a meal", constraints: null };

test("suggest and accept independent siblings; manual edits and retries preserve the parent", async ({ playwright, baseURL }, info) => {
  test.setTimeout(240_000);
  expect(process.env.TEST_DATABASE_URL).toBeTruthy();
  expect(process.env.DATABASE_URL).toBe(process.env.TEST_DATABASE_URL);
  expect(process.env.AI_STUB_DIR).toBeTruthy();
  const sql = neon(process.env.TEST_DATABASE_URL!);
  const origin = new URL(baseURL!).origin, headers = { origin };
  const [owner, stranger] = await Promise.all([0, 1].map(() => playwright.request.newContext({ baseURL: origin })));
  try {
    for (const client of [owner, stranger]) expect((await client.post("/api/workspace", { headers })).status()).toBe(201);
    const saved = await owner.post("/api/ideas", { headers: { ...headers, "Idempotency-Key": randomUUID() }, data: fields });
    expect(saved.status()).toBe(201);
    const parent = await saved.json();
    const before = await sql`select * from idea_versions where id = ${parent.versionId}::uuid`;
    const count = async () => (await sql`select count(*)::int as n from idea_versions where idea_id = ${parent.ideaId}::uuid`)[0].n;
    const proposal = await owner.post("/api/branches/suggest", { headers, data: { versionId: parent.versionId } });
    expect(proposal.status()).toBe(200);
    const { directions } = await proposal.json();
    expect(directions).toHaveLength(3);
    expect(directions.map(({ title, change }: { title: string; change: string }) => ({ title, change })))
      .toEqual(fixture.directions.map(({ title, change }) => ({ title, change })));
    expect(new Set(directions.map((d: { id: string }) => d.id)).size).toBe(3);
    expect(await count()).toBe(1);
    expect((await stranger.post("/api/branches/suggest", { headers, data: { versionId: parent.versionId } })).status()).toBe(404);
    expect((await stranger.post(`/api/branches/${directions[0].id}/accept`, { headers })).status()).toBe(404);
    expect((await stranger.post("/api/branches/manual", { headers, data: { versionId: parent.versionId, fields: { title: "Forbidden" } } })).status()).toBe(404);
    const responses = await Promise.all(directions.slice(0, 2).map((d: { id: string }) => owner.post(`/api/branches/${d.id}/accept`, { headers })));
    expect(responses.map((r) => r.status())).toEqual([201, 201]);
    const siblings = await Promise.all(responses.map((r) => r.json()));
    for (const [i, sibling] of siblings.entries()) {
      expect(sibling).toMatchObject({ ...fields, [fixture.directions[i].field]: fixture.directions[i].change,
        ideaId: parent.ideaId, parentId: parent.versionId, corpusVersion: parent.corpusVersion });
      expect(sibling.neighborIds).toHaveLength(5);
      expect([sibling.x, sibling.y, sibling.z].every(Number.isFinite)).toBe(true);
    }
    expect(siblings[0].versionId).not.toBe(siblings[1].versionId);
    const retry = await owner.post(`/api/branches/${directions[0].id}/accept`, { headers });
    expect(retry.status()).toBe(200); expect(await retry.json()).toEqual(siblings[0]);
    expect(await count()).toBe(3);
    // Concurrent accepts of one remaining direction still insert only once.
    const raced = await Promise.all([0, 1].map(() => owner.post(`/api/branches/${directions[2].id}/accept`, { headers })));
    expect(raced.map((r) => r.status()).sort()).toEqual([200, 201]);
    const racedVersions = await Promise.all(raced.map((r) => r.json()));
    expect(racedVersions[0]).toEqual(racedVersions[1]); expect(await count()).toBe(4);
    const manual = await owner.post("/api/branches/manual", { headers, data: {
      versionId: parent.versionId, fields: { title: "An organizer's meal plan", constraints: "Use event-provided food" } } });
    expect(manual.status()).toBe(201);
    const manualVersion = await manual.json();
    expect(manualVersion).toMatchObject({ ...fields, title: "An organizer's meal plan", constraints: "Use event-provided food",
      parentId: parent.versionId, ideaId: parent.ideaId });
    expect(await count()).toBe(5);
    expect(await sql`select * from idea_versions where id = ${parent.versionId}::uuid`).toEqual(before);
    await writeFile(info.outputPath("branches.json"), JSON.stringify({ parent, directions, siblings, manual: manualVersion, count: await count() }, null, 2));
  } finally { await Promise.all([owner, stranger].map((client) => client.dispose())); }
});
