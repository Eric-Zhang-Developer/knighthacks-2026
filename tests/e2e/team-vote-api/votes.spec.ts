import { expect, test, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";

// Raw API requests from two real sessions in one workspace (owner + invited teammate), on the Neon test branch with
// real embeddings for the two ideas they vote on. Rows are kept. HTTP traces would hold session cookies.
test.use({ trace: "off" });
const idea = (title: string) => ({ title, description: `${title} for hackathon teams`, audience: "Hackathon teammates",
  problem: null, workflow: null, constraints: null });

test("votes stay private until both teammates vote, then both see both and later changes", async ({ playwright, baseURL }, info) => {
  test.setTimeout(120_000);
  expect(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL, "App and verifier must both use the test branch").toBe(true);
  const origin = new URL(baseURL!).origin, headers = { origin };
  const [a, b, stranger, anonymous] = await Promise.all([0, 1, 2, 3].map(() => playwright.request.newContext({ baseURL: origin })));
  const json = async (r: Awaited<ReturnType<APIRequestContext["get"]>>, status = 200): Promise<Record<string, string>> => { expect(r.status()).toBe(status); return (await r.json()) as Record<string, string>; };
  const vote = (c: APIRequestContext, versionId: string, concern: string | null) => c.put("/api/votes", { headers, data: { versionId, concern } });

  await json(await a.post("/api/workspace", { headers }), 201);
  const { inviteUrl } = await json(await a.post("/api/workspace/invite", { headers, data: {} }), 201);
  await json(await b.post("/api/workspace/invite/redeem", { headers, data: { token: new URL(inviteUrl).pathname.split("/").pop() } }), 201);
  await json(await stranger.post("/api/workspace", { headers }), 201);
  const save = (c: APIRequestContext, title: string) => c.post("/api/ideas", { headers: { ...headers, "Idempotency-Key": randomUUID() }, data: idea(title) });
  const one = await json(await save(a, "Shared meal planner"), 201), two = await json(await save(b, "Snack drop scheduler"), 201);

  expect(await json(await anonymous.get("/api/votes"), 401)).toHaveProperty("error");
  expect(await json(await a.get("/api/votes"))).toEqual({ mine: null, theirs: null, revealed: false });
  expect((await vote(stranger, one.versionId, null)).status(), "another workspace's version").toBe(404);
  expect((await stranger.put("/api/votes", { headers: { origin: "https://evil.test" }, data: { versionId: one.versionId, concern: null } })).status()).toBe(403);

  // A votes. A sees only their own vote; B's raw response carries nothing of A's.
  const concernA = `A worries about allergies ${randomUUID()}`;
  expect(await json(await vote(a, one.versionId, concernA))).toMatchObject({ mine: { versionId: one.versionId, concern: concernA }, theirs: null, revealed: false });
  const rawB = await (await b.get("/api/votes")).text();
  expect(JSON.parse(rawB)).toEqual({ mine: null, theirs: null, revealed: false });
  expect(rawB).not.toContain(one.versionId); expect(rawB).not.toContain(concernA);

  // B votes for the other version: both now see both, with no agreement.
  const revealedB = await json(await vote(b, two.versionId, null));
  expect(revealedB).toMatchObject({ revealed: true, agreement: false, mine: { versionId: two.versionId }, theirs: { versionId: one.versionId, concern: concernA, changedAfterReveal: false } });
  const revealedA = await json(await a.get("/api/votes"));
  expect(revealedA).toMatchObject({ revealed: true, agreement: false, mine: { versionId: one.versionId }, theirs: { versionId: two.versionId } });

  // A changes their vote after the reveal: allowed, agreement now true, and flagged as changed for both to see.
  const changed = await json(await vote(a, two.versionId, concernA));
  expect(changed).toMatchObject({ revealed: true, agreement: true, mine: { versionId: two.versionId, changedAfterReveal: true } });
  expect(await json(await b.get("/api/votes"))).toMatchObject({ agreement: true, theirs: { versionId: two.versionId, changedAfterReveal: true }, mine: { changedAfterReveal: false } });
  expect(await json(await stranger.get("/api/votes"))).toEqual({ mine: null, theirs: null, revealed: false });

  await writeFile(info.outputPath("votes.json"), JSON.stringify({ rawBBeforeReveal: JSON.parse(rawB), revealedB, revealedA, changed }, null, 2));
  await Promise.all([a, b, stranger, anonymous].map((c) => c.dispose()));
});
