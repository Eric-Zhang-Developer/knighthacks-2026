import { randomUUID } from "node:crypto";
import { copyFile, readdir, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import draft from "./fixtures/experiment-draft.json";

// Real backend on the Neon test branch; the model is stubbed through AI_STUB_DIR (a fresh absolute temp folder this
// test copies its fixtures into) with AI_STUB_ALLOW=1. Round 1's outcome is `test`, round 2's is `revise`.
test.use({ trace: "off" }); // traces would hold session cookies

test("a `test` round starts a ten-minute experiment; results are recorded without touching versions", async ({ playwright, baseURL }) => {
  test.setTimeout(180_000);
  expect(process.env.TEST_DATABASE_URL, "set TEST_DATABASE_URL").toBeTruthy();
  expect(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL, "App and verifier must use the test branch").toBe(true);
  const stub = process.env.AI_STUB_DIR;
  expect(stub && isAbsolute(stub), "Set AI_STUB_DIR to a fresh absolute temp folder").toBeTruthy();
  expect(process.env.AI_STUB_ALLOW).toBe("1");
  const fixtures = join(__dirname, "fixtures");
  for (const f of await readdir(fixtures)) await copyFile(join(fixtures, f), join(stub!, f));

  const sql = neon(process.env.TEST_DATABASE_URL!);
  const versions = (ideaId: string) => sql`select id, md5(to_jsonb(v)::text) as fingerprint from idea_versions v where idea_id = ${ideaId}::uuid order by id`;
  const origin = new URL(baseURL!).origin, headers = { origin };
  const [owner, stranger] = await Promise.all([0, 1].map(() => playwright.request.newContext({ baseURL: origin })));
  for (const client of [owner, stranger]) expect((await client.post("/api/workspace", { headers })).status()).toBe(201);

  const idea = await owner.post("/api/ideas", { headers: { ...headers, "Idempotency-Key": randomUUID() }, data: {
    title: "Hackathon meal coordination", description: "Help teammates choose shared meals that meet dietary requirements.",
    audience: "Hackathon teammates", problem: "Meal coordination interrupts building", workflow: "Collect requirements and choose a shared meal", constraints: null,
  } });
  expect(idea.status(), "needs real HF embeddings and the current test schema").toBe(201);
  const version = await idea.json();
  const before = await versions(version.ideaId);

  const session = await owner.post("/api/challenge", { headers, data: { versionId: version.versionId, perspective: "judge" } });
  expect(session.status()).toBe(201);
  const { sessionId } = await session.json();
  const challenge = `/api/challenge/${sessionId}`;
  for (const answer of ["We'd time it at the next team dinner.", "Whoever has the strictest diet decides."]) {
    expect((await owner.post(`${challenge}/round`, { headers })).status()).toBe(200);
    expect((await owner.post(`${challenge}/answer`, { headers, data: { answer } })).status()).toBe(200);
  }

  // Validation 1: a `test` round drafts all three parts, with no result.
  const started = await owner.post("/api/experiments", { headers, data: { sessionId, round: 1 } });
  expect(started.status()).toBe(201);
  const experiment = await started.json();
  expect(experiment).toMatchObject({
    sessionId, round: 1, assumption: "Teammates can agree on a shared meal in under five minutes with the selection step.",
    hypothesis: { text: draft.hypothesis, label: "unverified", sourceIds: [] },
    procedure: draft.procedure, observable: draft.observable, result: null, note: null,
  });
  // One experiment per assumption: asking again returns the same one.
  const again = await owner.post("/api/experiments", { headers, data: { sessionId, round: 1 } });
  expect(again.status()).toBe(200);
  expect((await again.json()).id).toBe(experiment.id);

  // Validation 2: any other outcome is a 409.
  expect((await owner.post("/api/experiments", { headers, data: { sessionId, round: 2 } })).status()).toBe(409);

  // Edit a part, then record the result; the idea's versions never change.
  const endpoint = `/api/experiments/${experiment.id}`;
  const edited = await owner.patch(endpoint, { headers, data: { observable: "Minutes to name one meal, per team; under 5 for all three confirms." } });
  expect(edited.status()).toBe(200);
  expect((await edited.json()).result).toBeNull();
  expect((await owner.patch(endpoint, { headers, data: { result: "maybe" } })).status()).toBe(400);
  expect((await owner.patch(endpoint, { headers, data: { result: "refuted", observable: "x" } })).status()).toBe(400);
  const recorded = await owner.patch(endpoint, { headers, data: { result: "refuted", note: "Two of three teams took over eight minutes." } });
  expect(recorded.status()).toBe(200);
  expect(await recorded.json()).toMatchObject({ result: "refuted", note: "Two of three teams took over eight minutes." });
  expect(await versions(version.ideaId)).toEqual(before);

  const listed = await owner.get(`/api/experiments?versionId=${version.versionId}`);
  expect(await listed.json()).toEqual([expect.objectContaining({ id: experiment.id, result: "refuted", hypothesis: expect.objectContaining({ label: "unverified" }) })]);

  // Another workspace sees nothing and can change nothing.
  expect((await stranger.post("/api/experiments", { headers, data: { sessionId, round: 1 } })).status()).toBe(404);
  expect((await stranger.patch(endpoint, { headers, data: { result: "confirmed" } })).status()).toBe(404);
  expect(await (await stranger.get(`/api/experiments?versionId=${version.versionId}`)).json()).toEqual([]);

  // Keep the stored row.
  const [row] = await sql`select to_jsonb(e) as row from experiments e where id = ${experiment.id}::uuid`;
  expect(row.row).toMatchObject({ result: "refuted", round: 1, session_id: sessionId });
  await writeFile(test.info().outputPath("experiment-row.json"), JSON.stringify(row.row, null, 2));
  await Promise.all([owner.dispose(), stranger.dispose()]);
});
