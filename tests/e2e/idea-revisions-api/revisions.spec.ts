import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import fixture from "./fixtures/revision-propose.json";

// Generation is stubbed (AI_STUB_DIR=tests/e2e/idea-revisions-api/fixtures, AI_STUB_ALLOW=1); embeddings and Neon are
// real, on the dedicated test branch. Rows are kept for review (spec Validation 3). HTTP traces hold session cookies.
test.use({ trace: "off" });
const fields = { title: "Hackathon meal planning", description: "Help hackathon teams plan shared meals around their dietary constraints.",
  audience: "Hackathon teammates", problem: "Coordinating meals while building together",
  workflow: "Collect each teammate's dietary constraints and choose a shared meal", constraints: null };

test("propose, reject without a write, accept as a child, and concurrent accepts as siblings", async ({ playwright, baseURL }, info) => {
  test.setTimeout(180_000);
  expect(process.env.TEST_DATABASE_URL, "Set the dedicated Neon TEST_DATABASE_URL").toBeTruthy();
  expect(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL, "App and verifier must both use the test branch").toBe(true);
  expect(process.env.AI_STUB_DIR, "Start the server with this test's AI_STUB_DIR").toBeTruthy();
  const sql = neon(process.env.TEST_DATABASE_URL!);
  const origin = new URL(baseURL!).origin, headers = { origin };
  const [owner, stranger] = await Promise.all([0, 1].map(() => playwright.request.newContext({ baseURL: origin })));
  for (const client of [owner, stranger]) expect((await client.post("/api/workspace", { headers })).status()).toBe(201);
  const v1 = await (await owner.post("/api/ideas", { headers: { ...headers, "Idempotency-Key": randomUUID() }, data: fields })).json();
  const versions = async () => (await sql`select count(*)::int as n from idea_versions where idea_id = ${v1.ideaId}::uuid`)[0].n;

  // 1. Propose -> up to three suggestions, stored against v1.
  const proposed = await owner.post("/api/revisions/propose", { headers, data: { versionId: v1.versionId, context: "challenge: teams don't order food" } });
  expect(proposed.status()).toBe(200);
  const { suggestions } = await proposed.json();
  expect(suggestions.map(({ field, change, reason }: Record<string, string>) => ({ field, change, reason }))).toEqual(fixture.suggestions);
  const [first, second, third] = suggestions;
  expect((await stranger.post(`/api/revisions/${first.id}/accept`, { headers })).status(), "another workspace can't accept").toBe(404);
  expect((await stranger.post("/api/revisions/propose", { headers, data: { versionId: v1.versionId } })).status()).toBe(404);

  // Reject -> no new row, and nothing about the suggestion changes.
  const before = await sql`select * from revision_suggestions where id = ${first.id}::uuid`;
  expect((await owner.post(`/api/revisions/${first.id}/reject`, { headers })).status()).toBe(200);
  expect(await versions()).toBe(1);
  expect(await sql`select * from revision_suggestions where id = ${first.id}::uuid`).toEqual(before);

  // Accept -> a new row whose parent is v1, with the one field changed and its own placement; a retry returns it.
  const accepted = await owner.post(`/api/revisions/${second.id}/accept`, { headers });
  expect(accepted.status()).toBe(201);
  const v2 = await accepted.json();
  expect(v2).toMatchObject({ ...fields, workflow: second.change, ideaId: v1.ideaId, parentId: v1.versionId });
  expect(new Set(v2.neighborIds).size).toBe(5);
  const retry = await owner.post(`/api/revisions/${second.id}/accept`, { headers });
  expect(retry.status()).toBe(200);
  expect(await retry.json()).toEqual(v2);
  expect(await versions()).toBe(2);

  // 2. Two accepts at once on one parent -> two sibling rows.
  const raced = await Promise.all([first, third].map((s) => owner.post(`/api/revisions/${s.id}/accept`, { headers })));
  expect(raced.map((r) => r.status())).toEqual([201, 201]);
  const siblings = await Promise.all(raced.map((r) => r.json()));
  expect(siblings.map((v) => v.parentId)).toEqual([v1.versionId, v1.versionId]);
  expect(siblings[0].versionId).not.toBe(siblings[1].versionId);
  expect(await versions()).toBe(4);

  // Trail: every version with its parent, oldest first; invisible to another workspace.
  const trail = await (await owner.get(`/api/revisions/trail/${v1.ideaId}`)).json();
  expect(trail.map((v: { versionId: string }) => v.versionId).slice(0, 2)).toEqual([v1.versionId, v2.versionId]);
  expect(trail.map((v: { parentId: string | null }) => v.parentId)).toEqual([null, v1.versionId, v1.versionId, v1.versionId]);
  expect((await stranger.get(`/api/revisions/trail/${v1.ideaId}`)).status()).toBe(404);

  const evidence = JSON.stringify({ ideaId: v1.ideaId, suggestions, trail }, null, 2);
  await writeFile(info.outputPath("trail.json"), evidence);
  await Promise.all([owner, stranger].map((c) => c.dispose()));
});
