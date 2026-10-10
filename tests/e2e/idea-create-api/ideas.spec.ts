import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import fixture from "./fixtures/idea-interpret.json";

// HTTP traces contain session cookies. Keep only public idea rows and assertions.
test.use({ trace: "off" });
const live = process.env.UNCHARTED_VERIFY_LIVE_IDEA === "1";
const fieldNames = ["title", "description", "audience", "problem", "workflow", "constraints"];
const versionNames = [...fieldNames, "ideaId", "versionId", "parentId", "x", "y", "z", "neighborIds", "corpusVersion", "createdAt"].sort();
const input = "Help hackathon teammates plan shared meals. Collect dietary constraints and choose a meal together, so the team can keep building.";

test("interpret, persist real placement, isolate workspaces and serialize duplicate saves", async ({ playwright, baseURL }, info) => {
  test.setTimeout(210_000);
  expect(Boolean(process.env.TEST_DATABASE_URL), "Set the dedicated Neon TEST_DATABASE_URL before verification").toBe(true);
  expect(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL, "App and verifier must both use the dedicated test branch").toBe(true);
  if (live) {
    expect(Boolean(process.env.AI_STUB_DIR), "Live acceptance must not use generation fixtures").toBe(false);
  } else {
    expect(Boolean(process.env.AI_STUB_DIR), "Set AI_STUB_DIR to this test's fixtures before starting the server").toBe(true);
    expect(process.env.AI_STUB_ALLOW).toBe("1");
  }
  if (!baseURL) throw new Error("Playwright baseURL is required");
  const sql = neon(process.env.TEST_DATABASE_URL!);
  async function query<T>(operation: PromiseLike<T>): Promise<T> {
    try { return await operation; }
    catch { throw new Error("Idea verification database query failed on the test branch"); }
  }
  async function counts(workspaceId: string, key?: string) {
    const rows = key === undefined
      ? await query(sql`select count(distinct i.id)::int as ideas, count(v.id)::int as versions from ideas i left join idea_versions v on v.idea_id = i.id where i.workspace_id = ${workspaceId}::uuid`)
      : await query(sql`select count(distinct i.id)::int as ideas, count(v.id)::int as versions from ideas i left join idea_versions v on v.idea_id = i.id where i.workspace_id = ${workspaceId}::uuid and i.idempotency_key = ${key}`);
    return rows[0];
  }
  const origin = new URL(baseURL).origin;
  const headers = { origin };
  const clients = await Promise.all([0, 1, 2].map(() => playwright.request.newContext({ baseURL: origin })));
  const [owner, stranger, anonymous] = clients;
  const created = new Set<string>();
  let retainedWorkspace: string | undefined;
  try {
    expect((await anonymous.get("/api/ideas")).status()).toBe(401);
    const workspaceIds: string[] = [];
    for (const client of [owner, stranger]) {
      const response = await client.post("/api/workspace", { headers });
      expect(response.status(), "Workspace creation requires the pushed test schema").toBe(201);
      const identity = await response.json();
      expect(identity.workspaceId).toMatch(/^[0-9a-f-]{36}$/i);
      created.add(identity.workspaceId);
      workspaceIds.push(identity.workspaceId);
    }
    const [workspaceId, strangerId] = workspaceIds;
    const beforeInterpret = await counts(workspaceId);
    expect(beforeInterpret).toEqual({ ideas: 0, versions: 0 });
    const interpretation = await owner.post("/api/ideas/interpret", { headers, data: { text: input } });
    expect(interpretation.status(), "Interpretation must use the configured fixture or a live provider").toBe(200);
    const fields = await interpretation.json();
    expect(Object.keys(fields).sort()).toEqual([...fieldNames].sort());
    for (const field of fieldNames) expect(fields[field] === null || typeof fields[field] === "string").toBe(true);
    if (!live) expect(fields).toEqual(fixture);
    expect(await counts(workspaceId)).toEqual(beforeInterpret);

    const key = randomUUID();
    const save = await owner.post("/api/ideas", { headers: { ...headers, "Idempotency-Key": key }, data: fields });
    expect(save.status(), "Save must use real HF embeddings and the test Neon corpus").toBe(201);
    const saved = await save.json();
    expect(Object.keys(saved).sort()).toEqual(versionNames);
    expect(saved).toMatchObject({ ...fields, parentId: null });
    expect(new Set(saved.neighborIds).size).toBe(5);
    expect(Number.isNaN(Date.parse(saved.createdAt))).toBe(false);
    const placement = await query(sql`select avg(x)::double precision as x, avg(y)::double precision as y, avg(z)::double precision as z, count(*)::int as neighbors, count(distinct corpus_version)::int as versions, min(corpus_version) as corpus_version from projects where id = any(array(select jsonb_array_elements_text(${JSON.stringify(saved.neighborIds)}::jsonb)))`);
    expect(placement[0]).toMatchObject({ neighbors: 5, versions: 1, corpus_version: saved.corpusVersion });
    for (const axis of ["x", "y", "z"]) {
      expect(Number.isFinite(saved[axis])).toBe(true);
      expect(saved[axis]).toBeCloseTo(Number(placement[0][axis]), 5);
    }
    const vector = await query(sql`select vector_dims(embedding)::int as dimensions, vector_norm(embedding) as norm from idea_versions where id = ${saved.versionId}::uuid`);
    expect(vector[0].dimensions).toBe(1024);
    expect(Number(vector[0].norm)).toBeCloseTo(1, 4);
    const nearest = await query(sql`select p.id from projects p cross join idea_versions v where v.id = ${saved.versionId}::uuid order by p.embedding <=> v.embedding limit 5`);
    expect(saved.neighborIds).toEqual(nearest.map((row) => row.id));

    const retry = await owner.post("/api/ideas", { headers: { ...headers, "Idempotency-Key": key }, data: fields });
    expect(retry.status()).toBe(200);
    expect(await retry.json()).toEqual(saved);
    expect(await counts(workspaceId, key)).toEqual({ ideas: 1, versions: 1 });
    const listed = await owner.get("/api/ideas");
    expect(listed.status()).toBe(200);
    expect(await listed.json()).toEqual([saved]);
    const foreign = await stranger.get(`/api/ideas?workspaceId=${workspaceId}`);
    expect(foreign.status()).toBe(200);
    expect(await foreign.json()).toEqual([]);

    const raceKey = randomUUID();
    const raced = await Promise.all([0, 1].map(() => owner.post("/api/ideas", { headers: { ...headers, "Idempotency-Key": raceKey }, data: fields })));
    expect(raced.map((response) => response.status()).sort()).toEqual([200, 201]);
    const raceRows = await Promise.all(raced.map((response) => response.json()));
    expect(raceRows[0]).toEqual(raceRows[1]);
    const raceCounts = await counts(workspaceId, raceKey);
    expect(raceCounts).toEqual({ ideas: 1, versions: 1 });
    expect(await counts(workspaceId)).toEqual({ ideas: 2, versions: 2 });
    const otherSave = await stranger.post("/api/ideas", { headers: { ...headers, "Idempotency-Key": key }, data: fields });
    expect(otherSave.status()).toBe(201);
    const other = await otherSave.json();
    expect(other.ideaId).not.toBe(saved.ideaId);
    expect(other.versionId).not.toBe(saved.versionId);
    expect(await counts(strangerId)).toEqual({ ideas: 1, versions: 1 });
    const ownerRead = await owner.get("/api/ideas");
    expect(ownerRead.status()).toBe(200);
    expect((await ownerRead.json()).map((row: { ideaId: string }) => row.ideaId).sort()).toEqual([saved.ideaId, raceRows[0].ideaId].sort());
    const evidence = JSON.stringify({ mode: live ? "live" : "generation-fixture", input, interpreted: fields, savedRow: saved, centroid: placement[0], embedding: vector[0], retryStatus: retry.status(), raceStatuses: raced.map((response) => response.status()), raceCounts, crossWorkspaceIsolated: true, liveWorkspaceRetained: live ? workspaceId : null }, null, 2);
    await writeFile(info.outputPath("saved-idea.json"), evidence);
    await info.attach("saved-idea", { body: evidence, contentType: "application/json" });
    // Retain the successful live row for acceptance review; fixture runs clean up.
    if (live) retainedWorkspace = workspaceId;
  } finally {
    const cleanup = [...created].filter((id) => id !== retainedWorkspace);
    const results = await Promise.allSettled(cleanup.map((id) => sql`delete from workspaces where id = ${id}::uuid`));
    await Promise.allSettled(clients.map((client) => client.dispose()));
    if (results.some((result) => result.status === "rejected")) throw new Error("Test idea cleanup failed for an explicitly created workspace");
  }
});
