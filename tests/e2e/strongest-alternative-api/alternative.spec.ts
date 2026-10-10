import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";

test.use({ trace: "off" });
test("compare the top saved neighbor once and skip generation when workflow is missing", async ({ playwright, baseURL }, info) => {
  test.setTimeout(180_000);
  expect(Boolean(process.env.TEST_DATABASE_URL)).toBe(true);
  expect(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL).toBe(true);
  const fixtureRoot = process.env.AI_STUB_DIR;
  expect(Boolean(fixtureRoot) && isAbsolute(fixtureRoot!)).toBe(true);
  expect(process.env.AI_STUB_ALLOW).toBe("1");
  if (!baseURL || !fixtureRoot) throw new Error("Verifier URL and fresh fixture directory required");
  const sql = neon(process.env.TEST_DATABASE_URL!);
  async function query<T>(operation: PromiseLike<T>): Promise<T> {
    try { return await operation; }
    catch { throw new Error("Alternative verification query failed on the test database"); }
  }
  const origin = new URL(baseURL).origin, headers = { origin };
  const clients = await Promise.all([0, 1, 2].map(() => playwright.request.newContext({ baseURL: origin })));
  const [owner, stranger, anonymous] = clients;
  const workspaces = new Set<string>(), fixtures = new Set<string>();
  let retainedWorkspace: string | undefined;
  try {
    let workspaceId = "";
    for (const client of [owner, stranger]) {
      const response = await client.post("/api/workspace", { headers });
      expect(response.status()).toBe(201);
      const data = await response.json(); workspaces.add(data.workspaceId);
      if (client === owner) workspaceId = data.workspaceId;
    }
    const workflow = "Collect dietary requirements and choose a shared meal";
    async function idea(workflow: string | null) {
      const response = await owner.post("/api/ideas", { headers: { ...headers, "Idempotency-Key": randomUUID() }, data: {
        title: "Hackathon meal coordination", description: "Help teammates choose shared meals that meet dietary requirements.",
        audience: "Hackathon teammates", problem: "Meal coordination interrupts building", workflow, constraints: null,
      } });
      expect(response.status(), "Requires real HF embeddings").toBe(201); return response.json();
    }
    const version = await idea(workflow), endpoint = `/api/alternative/${version.versionId}`;
    expect((await owner.get(endpoint)).status()).toBe(404);
    expect((await stranger.post(endpoint, { headers })).status()).toBe(404);
    expect((await anonymous.post(endpoint, { headers })).status()).toBe(401);
    expect((await owner.post(endpoint, { headers: { origin: "https://foreign.invalid" } })).status()).toBe(403);
    const source = (await query(sql`select id, title, url, description, tagline from projects where id = ${version.neighborIds[0]}`))[0];
    expect(Boolean(source)).toBe(true);
    const excerpt = [source.description, source.tagline, source.title].find((value) => typeof value === "string" && value.trim()) as string;
    const points = [
      { step: "Collect dietary requirements", claim: { text: excerpt.trim().slice(0, 100), label: "supported", sourceIds: [source.id] } },
      { step: "choose a shared meal", claim: { text: "Whether the described alternative supports this exact meal-selection step remains unverified.", label: "unverified", sourceIds: [source.id] } },
    ];
    const fixture = join(fixtureRoot, `alternative-${source.id}.json`);
    await writeFile(fixture, JSON.stringify({ points }), { flag: "wx" }); fixtures.add(fixture);
    const firstPosts = await Promise.all([0, 1].map(() => owner.post(endpoint, { headers })));
    for (const first of firstPosts) expect(first.status()).toBe(200);
    const response = firstPosts[0];
    const data = await response.json();
    expect(data).toEqual({ versionId: version.versionId, projectId: source.id, url: source.url, title: source.title, points, missingWorkflow: false });
    expect(await firstPosts[1].json()).toEqual(data);
    expect(data.projectId).toBe(version.neighborIds[0]);
    expect(data.points).toHaveLength(2);
    for (const point of data.points) {
      expect(workflow.includes(point.step)).toBe(true);
      expect(point.claim.sourceIds.every((id: string) => id === source.id)).toBe(true);
    }
    const before = await query(sql`select to_jsonb(a) as row from strongest_alternatives a where version_id = ${version.versionId}::uuid`);
    expect(before).toHaveLength(1); expect(before[0].row.data).toEqual(data);
    await unlink(fixture); fixtures.delete(fixture);
    // The fixture directory is now empty: any unexpected generate() call must fail.
    const repeated = await Promise.all([0, 1].map(() => owner.post(endpoint, { headers })));
    for (const repeat of repeated) { expect(repeat.status()).toBe(200); expect(await repeat.json()).toEqual(data); }
    expect(await query(sql`select to_jsonb(a) as row from strongest_alternatives a where version_id = ${version.versionId}::uuid`)).toEqual(before);
    const read = await owner.get(endpoint); expect(read.status()).toBe(200); expect(await read.json()).toEqual(data);
    expect((await stranger.get(endpoint)).status()).toBe(404);
    expect((await anonymous.get(endpoint)).status()).toBe(401);
    const missing = await idea(null), missingEndpoint = `/api/alternative/${missing.versionId}`;
    const withoutWorkflow = await owner.post(missingEndpoint, { headers }); expect(withoutWorkflow.status()).toBe(200);
    const missingData = await withoutWorkflow.json();
    expect(missingData).toMatchObject({ versionId: missing.versionId, projectId: missing.neighborIds[0], points: [], missingWorkflow: true });
    const missingStored = await query(sql`select data from strongest_alternatives where version_id = ${missing.versionId}::uuid`);
    expect(missingStored).toHaveLength(1); expect(missingStored[0].data).toEqual(missingData);
    expect(await (await owner.get(missingEndpoint)).json()).toEqual(missingData);
    const report = JSON.stringify({ mode: "generation-fixture-real-neon-and-hugging-face", retainedWorkspace: workspaceId,
      storedAlternative: before[0].row, missingWorkflow: missingData, concurrentFirstCreatesStoredOneRow: true, cachedReadWithFixtureRemoved: true,
      missingWorkflowWithNoFixture: true, foreignWorkspaceStatus: 404 }, null, 2);
    await writeFile(info.outputPath("stored-alternatives.json"), report);
    await info.attach("stored-alternatives", { body: report, contentType: "application/json" });
    retainedWorkspace = workspaceId;
  } finally {
    const cleanup = await Promise.allSettled([...workspaces].filter((id) => id !== retainedWorkspace).map((id) => sql`delete from workspaces where id = ${id}::uuid`));
    const files = await Promise.allSettled([...fixtures].map((path) => unlink(path)));
    await Promise.allSettled(clients.map((client) => client.dispose()));
    if ([...cleanup, ...files].some((result) => result.status === "rejected")) throw new Error("Alternative cleanup failed for its explicit test resources");
  }
});
