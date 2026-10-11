import { randomUUID, createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";

test.use({ trace: "off" });
test("delete isolates workspaces, cascades branched versions, and preserves independent exports", async ({ playwright, baseURL }) => {
  test.setTimeout(90_000);
  expect(Boolean(process.env.TEST_DATABASE_URL)).toBe(true);
  expect(process.env.DATABASE_URL).toBe(process.env.TEST_DATABASE_URL);
  const sql = neon(process.env.TEST_DATABASE_URL!);
  const origin = new URL(baseURL!).origin;
  const owner = await playwright.request.newContext({ baseURL });
  const stranger = await playwright.request.newContext({ baseURL });
  const anonymous = await playwright.request.newContext({ baseURL });
  const workspaces: string[] = [];
  const ideaId = randomUUID(), otherIdea = randomUUID(), root = randomUUID(), child = randomUUID();
  const snapshotId = randomUUID();
  const tokenHash = createHash("sha256").update(randomUUID()).digest("hex");
  const snapshot = { versionId: root, idea: { title: "Deletion test export" } };
  try {
    for (const client of [owner, stranger]) {
      const response = await client.post("/api/workspace", { headers: { origin } });
      expect(response.status()).toBe(201);
      workspaces.push((await response.json()).workspaceId);
    }
    for (const id of [ideaId, otherIdea]) {
      await sql`insert into ideas(id, workspace_id, idempotency_key) values (${id}::uuid, ${workspaces[0]}::uuid, ${randomUUID()})`;
    }
    const vector = `[${[1, ...Array(1023).fill(0)].join(",")}]`;
    for (const [id, idea, parent] of [[root, ideaId, null], [child, ideaId, root], [randomUUID(), otherIdea, null]]) {
      await sql`insert into idea_versions(id, idea_id, parent_id, title, embedding, x, y, z, neighbor_ids, corpus_version)
        values (${id}::uuid, ${idea}::uuid, ${parent}::uuid, 'Deletion test idea', ${vector}::vector, 0, 0, 0, array[]::text[], 'test-only')`;
    }
    await sql`insert into evidence_cards(version_id, project_id, url, title, excerpt, overlaps, differences, uncertainty)
      values (${child}::uuid, 'deletion-test', 'https://example.com', 'Test fixture', '', '[]', '[]',
        '{"text":"Test fixture","label":"unverified","sourceIds":[]}')`;
    await sql`insert into snapshots(id, workspace_id, data) values (${snapshotId}::uuid, ${workspaces[0]}::uuid, ${JSON.stringify(snapshot)}::jsonb)`;
    await sql`insert into shares(token_hash, snapshot_id) values (${tokenHash}, ${snapshotId}::uuid)`;
    const path = `/api/ideas/${ideaId}`;
    expect((await anonymous.delete(path, { headers: { origin } })).status()).toBe(401);
    expect((await owner.delete(path, { headers: { origin: "https://other.test" } })).status()).toBe(403);
    expect((await stranger.delete(path, { headers: { origin } })).status()).toBe(404);
    expect((await owner.delete("/api/ideas/not-an-id", { headers: { origin } })).status()).toBe(404);
    expect((await sql`select id from ideas where id = ${ideaId}::uuid`)).toHaveLength(1);
    const response = await owner.delete(path, { headers: { origin } });
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ ideaId, deleted: true });
    expect((await owner.delete(path, { headers: { origin } })).status()).toBe(404);
    expect(await sql`select id from idea_versions where idea_id = ${ideaId}::uuid`).toHaveLength(0);
    expect(await sql`select project_id from evidence_cards where version_id = ${child}::uuid`).toHaveLength(0);
    expect(await sql`select id from ideas where id = ${otherIdea}::uuid`).toHaveLength(1);
    const list = await owner.get("/api/ideas");
    expect(list.status()).toBe(200);
    expect((await list.json()).map((idea: { ideaId: string }) => idea.ideaId)).toEqual([otherIdea]);
    const state = await owner.get("/api/workspace/state");
    expect(state.status()).toBe(200);
    expect((await state.json()).ideas.map((idea: { ideaId: string }) => idea.ideaId)).toEqual([otherIdea]);
    expect((await sql`select data from snapshots where id = ${snapshotId}::uuid`)[0].data).toEqual(snapshot);
    expect(await sql`select token_hash from shares where token_hash = ${tokenHash}`).toHaveLength(1);
  } finally {
    // Only UUIDs created by this test are eligible for cleanup.
    for (const id of workspaces) await sql`delete from workspaces where id = ${id}::uuid`;
    await Promise.all([owner.dispose(), stranger.dispose(), anonymous.dispose()]);
  }
});
