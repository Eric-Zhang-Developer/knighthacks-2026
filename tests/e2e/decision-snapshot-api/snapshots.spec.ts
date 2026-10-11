import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";

test.use({ trace: "off" }); // Do not retain workspace session cookies.
const fields = {
  title: "Hackathon meal coordination", description: "Help teammates choose shared meals that meet dietary requirements.",
  audience: "Hackathon teammates", problem: "Meal coordination interrupts building",
  workflow: "Collect requirements and choose a shared meal", constraints: null,
};

test("freeze saved evidence and a proposed test, then keep identical bytes after a revision", async ({ playwright, baseURL }, info) => {
  test.setTimeout(210_000);
  expect(Boolean(process.env.TEST_DATABASE_URL)).toBe(true);
  expect(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL, "App and verifier must use the dedicated test branch").toBe(true);
  const fixtureRoot = process.env.AI_STUB_DIR;
  expect(Boolean(fixtureRoot) && isAbsolute(fixtureRoot!)).toBe(true);
  expect(process.env.AI_STUB_ALLOW).toBe("1");
  if (!baseURL || !fixtureRoot) throw new Error("Verifier URL and fresh fixture directory required");
  const sql = neon(process.env.TEST_DATABASE_URL!);
  async function query<T>(operation: PromiseLike<T>): Promise<T> {
    try { return await operation; }
    catch { throw new Error("Snapshot verification query failed on the test database"); }
  }
  const origin = new URL(baseURL).origin, headers = { origin };
  const clients = await Promise.all([0, 1, 2].map(() => playwright.request.newContext({ baseURL: origin })));
  const [owner, stranger, anonymous] = clients;
  const workspaces = new Set<string>(), fixtures = new Set<string>();
  let retainedWorkspace: string | undefined;
  async function fixture(key: string, data: unknown) {
    const path = join(fixtureRoot!, `${key}.json`);
    await writeFile(path, JSON.stringify(data), { flag: "wx" }); fixtures.add(path);
  }
  try {
    let workspaceId = "";
    for (const client of [owner, stranger]) {
      const response = await client.post("/api/workspace", { headers });
      expect(response.status()).toBe(201);
      const body = await response.json(); workspaces.add(body.workspaceId);
      if (client === owner) workspaceId = body.workspaceId;
    }
    const created = await owner.post("/api/ideas", { headers: { ...headers, "Idempotency-Key": randomUUID() }, data: fields });
    expect(created.status(), "Requires real HF embeddings and current test schema").toBe(201);
    const version = await created.json();
    const request = { versionId: version.versionId };
    expect((await anonymous.post("/api/snapshots", { headers, data: request })).status()).toBe(401);
    expect((await stranger.post("/api/snapshots", { headers, data: request })).status()).toBe(404);
    expect((await owner.post("/api/snapshots", { headers: { origin: "https://foreign.invalid" }, data: request })).status()).toBe(403);
    async function snapshot(versionId = version.versionId) {
      const response = await owner.post("/api/snapshots", { headers, data: { versionId } });
      expect(response.status()).toBe(201);
      const body = await response.json();
      expect(Object.keys(body).sort()).toEqual(["data", "snapshotId"]);
      expect(body.snapshotId).toMatch(/^[a-f0-9-]{36}$/i);
      return body;
    }
    async function evidenceFixtures(neighborIds: string[]) {
      const records = await query(sql`select id, title, url, description, tagline from projects where id = any(${neighborIds}::text[])`);
      for (const id of neighborIds.slice(0, 3)) {
        if (fixtures.has(join(fixtureRoot!, `evidence-${id}.json`))) continue;
        const record = records.find((row) => row.id === id);
        expect(record).toBeTruthy();
        const excerpt = [record!.description, record!.tagline, record!.title].find((value) => typeof value === "string" && value.trim()) as string;
        await fixture(`evidence-${id}`, {
          overlaps: [{ text: excerpt.trim().slice(0, 100), label: "supported", sourceIds: [id] }],
          differences: [{ text: "Whether this idea serves a different meal-coordination need is unverified.", label: "unverified", sourceIds: [] }],
          uncertainty: { text: "The value of a shared meal-selection trial is not yet known.", label: "unverified", sourceIds: [] },
        });
      }
      return records;
    }
    const records = await evidenceFixtures(version.neighborIds);
    // Choose before the evidence panel has requested any cards (#177).
    const initial = await snapshot();
    expect(initial.data.whatDiffers, "Choosing a version must generate its missing evidence before freezing").toHaveLength(3);
    expect(initial.data.mainUncertainty).not.toBeNull(); expect(initial.data.nextTest).toBeNull();
    expect(initial.data.nearestAlternatives.map((p: { projectId: string }) => p.projectId)).toEqual(version.neighborIds);
    const evidenceResponse = await owner.get(`/api/evidence/${version.versionId}`);
    expect(evidenceResponse.status()).toBe(200);
    const { cards } = await evidenceResponse.json(); expect(cards).toHaveLength(3);
    const proposedTest = "Run a ten-minute meal-selection trial with teammates and record where a decision stalls.";
    const privateAnswer = `private-answer-${randomUUID()}`;
    const privateQuestion = `private-question-${randomUUID()}`;
    await fixture("challenge-round-1", { question: privateQuestion, assumption: "A trial can expose uncertainty.", source: { text: "Unverified until tested.", label: "unverified", sourceIds: [] }, test: proposedTest });
    await fixture("challenge-answer-1", { outcome: "test" });
    const challenge = await owner.post("/api/challenge", { headers, data: { ...request, perspective: "judge" } });
    expect(challenge.status()).toBe(201);
    const { sessionId } = await challenge.json();
    expect((await owner.post(`/api/challenge/${sessionId}/round`, { headers })).status()).toBe(200);
    expect((await owner.post(`/api/challenge/${sessionId}/answer`, { headers, data: { answer: privateAnswer } })).status()).toBe(200);
    const selectedProcedure = "Ask three teammates to choose a meal in ten minutes and record the first stalled decision.";
    await fixture("experiment-draft", { hypothesis: "A short trial reveals where meal decisions stall.", procedure: selectedProcedure,
      observable: "The first step where teammates cannot agree." });
    const experimentResponse = await owner.post("/api/experiments", { headers, data: { sessionId, round: 1 } });
    expect(experimentResponse.status()).toBe(201);
    const experiment = await experimentResponse.json();
    const frozen = await snapshot(), endpoint = `/api/snapshots/${frozen.snapshotId}`;
    expect(frozen.snapshotId).not.toBe(initial.snapshotId);
    expect(Object.keys(frozen.data).sort()).toEqual(["audience", "idea", "mainUncertainty", "nearestAlternatives", "nextTest", "versionId", "whatDiffers"]);
    expect(frozen.data).toMatchObject({ versionId: version.versionId, audience: fields.audience,
      idea: { title: fields.title, description: fields.description, problem: fields.problem, workflow: fields.workflow, constraints: null },
      mainUncertainty: { projectId: cards[0].projectId, claim: cards[0].uncertainty },
      nextTest: { text: selectedProcedure, label: "unverified", sourceIds: [] },
    });
    expect(Object.keys(frozen.data.idea).sort()).toEqual(["constraints", "description", "problem", "title", "workflow"]);
    expect(frozen.data.nearestAlternatives).toEqual(version.neighborIds.map((id: string) => {
      const record = records.find((row) => row.id === id)!;
      return { projectId: id, title: record.title, url: record.url };
    }));
    expect(frozen.data.whatDiffers).toEqual(cards.map((card: { projectId: string; differences: unknown[] }) => ({ projectId: card.projectId, claims: card.differences })));
    const before = await owner.get(endpoint); expect(before.status()).toBe(200);
    const bytes = await before.text(); expect(JSON.parse(bytes)).toEqual(frozen.data);
    expect(bytes).not.toContain(privateAnswer); expect(bytes).not.toContain(privateQuestion);
    expect((await anonymous.get(endpoint)).status()).toBe(401);
    expect((await stranger.get(endpoint)).status()).toBe(404);
    expect((await owner.get(`/api/snapshots/${randomUUID()}`)).status()).toBe(404);
    await fixture("revision-propose", { suggestions: [{ field: "workflow", change: "Trial a shared meal-selection step and record where decisions stall", reason: "Test the observed uncertainty before changing the broader idea." }] });
    const proposed = await owner.post("/api/revisions/propose", { headers, data: request });
    expect(proposed.status()).toBe(200);
    const { suggestions } = await proposed.json();
    const accepted = await owner.post(`/api/revisions/${suggestions[0].id}/accept`, { headers });
    expect(accepted.status()).toBe(201);
    const revised = await accepted.json(); expect(revised.parentId).toBe(version.versionId);
    const after = await owner.get(endpoint); expect(after.status()).toBe(200);
    expect(await after.text(), "Stored snapshot bytes must survive a later accepted revision").toBe(bytes);
    const chosenAgain = await snapshot(); expect(chosenAgain.snapshotId).not.toBe(frozen.snapshotId);
    expect(chosenAgain.data).toEqual(frozen.data);
    const completedExperiment = await owner.patch(`/api/experiments/${experiment.id}`, { headers,
      data: { result: "inconclusive", note: "The trial ended before teammates chose." } });
    expect(completedExperiment.status()).toBe(200);
    const afterExperiment = await snapshot();
    expect(afterExperiment.data.nextTest, "A completed experiment must not remain the next action or fall back to its challenge proposal").toBeNull();
    await evidenceFixtures(revised.neighborIds);
    const revisedSnapshot = await snapshot(revised.versionId);
    expect(revisedSnapshot.data.idea.workflow).toBe(suggestions[0].change);
    expect(revisedSnapshot.data.nextTest, "Tests from the parent version must not leak into a different version").toBeNull();
    expect(revisedSnapshot.data.mainUncertainty).not.toBeNull();
    expect(revisedSnapshot.data.whatDiffers).toHaveLength(3);

    const branchResponse = await owner.post("/api/branches/manual", { headers, data: {
      versionId: version.versionId, fields: { workflow: "Choose separate meals when teammates cannot share an order" },
    } });
    expect(branchResponse.status()).toBe(201);
    const branch = await branchResponse.json();
    expect(branch.parentId).toBe(version.versionId);
    expect((await (await owner.get(`/api/evidence/${branch.versionId}`)).json()).cards).toEqual([]);
    await evidenceFixtures(branch.neighborIds);
    // Missing generation fixtures force the real service's safe failure path.
    const unavailablePath = join(fixtureRoot!, `evidence-${branch.neighborIds[0]}.json`);
    await unlink(unavailablePath); fixtures.delete(unavailablePath);
    const failedChoice = await owner.post("/api/snapshots", { headers, data: { versionId: branch.versionId } });
    expect(failedChoice.status()).toBe(502);
    expect(await failedChoice.json()).toEqual({ error: "Evidence generation is temporarily unavailable. Please try again." });
    expect(await query(sql`select id from snapshots where workspace_id = ${workspaceId}::uuid and data->>'versionId' = ${branch.versionId}`)).toEqual([]);
    await evidenceFixtures(branch.neighborIds);
    const branchSnapshot = await snapshot(branch.versionId);
    const branchCards = (await (await owner.get(`/api/evidence/${branch.versionId}`)).json()).cards;
    expect(branchCards).toHaveLength(3);
    expect(branchSnapshot.data.whatDiffers).toEqual(branchCards.map((card: { projectId: string; differences: unknown[] }) => ({ projectId: card.projectId, claims: card.differences })));
    // A repeated choice must succeed even when generation is unavailable.
    for (const id of branch.neighborIds.slice(0, 3)) {
      const path = join(fixtureRoot!, `evidence-${id}.json`);
      await unlink(path); fixtures.delete(path);
    }
    const branchAgain = await snapshot(branch.versionId);
    expect(branchAgain.snapshotId).not.toBe(branchSnapshot.snapshotId);
    expect(branchAgain.data).toEqual(branchSnapshot.data);
    const initialAfter = await owner.get(`/api/snapshots/${initial.snapshotId}`);
    expect(await initialAfter.json()).toEqual(initial.data);
    const report = JSON.stringify({ mode: "generation-fixture-real-corpus-and-database", retainedWorkspace: workspaceId,
      versionId: version.versionId, revisedVersionId: revised.versionId, branchVersionId: branch.versionId,
      snapshotIds: [initial, frozen, chosenAgain, revisedSnapshot, branchSnapshot, branchAgain].map((s) => s.snapshotId),
      data: frozen.data, branchData: branchSnapshot.data, evidenceFailureSavedNothing: true, repeatedChoiceReusedCards: true,
      identicalBytesAfterRevision: true, privateFieldsExcluded: true, newChoiceGetsFreshId: true }, null, 2);
    await writeFile(info.outputPath("frozen-snapshot.json"), report);
    await info.attach("frozen-snapshot", { body: report, contentType: "application/json" });
    retainedWorkspace = workspaceId;
  } finally {
    const cleanup = await Promise.allSettled([...workspaces].filter((id) => id !== retainedWorkspace).map((id) => sql`delete from workspaces where id = ${id}::uuid`));
    const files = await Promise.allSettled([...fixtures].map((path) => unlink(path)));
    await Promise.allSettled(clients.map((client) => client.dispose()));
    if ([...cleanup, ...files].some((result) => result.status === "rejected")) throw new Error("Snapshot cleanup failed for its explicit test resources");
  }
});
