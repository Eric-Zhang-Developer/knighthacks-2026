import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { expect, test, type APIRequestContext } from "@playwright/test";

// Real backend on the Neon test branch with real embeddings; the model is stubbed through AI_STUB_DIR (a fresh
// absolute temp folder) with AI_STUB_ALLOW=1. Fixtures are written per step because they depend on real neighbors.
test.use({ trace: "off" }); // traces would hold session cookies
type Claim = { text: string; label: string; sourceIds: string[] };
type Item = { kind: string; assumption: Claim; reversal: { observe: string; reversesIf: string } | null; insufficient: boolean };

test("list an idea's assumptions with what would reverse each; malformed items are dropped; stored once", async ({ playwright, baseURL }) => {
  test.setTimeout(180_000);
  expect(process.env.TEST_DATABASE_URL, "set TEST_DATABASE_URL").toBeTruthy();
  expect(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL, "App and verifier must use the test branch").toBe(true);
  const stub = process.env.AI_STUB_DIR;
  expect(stub && isAbsolute(stub), "Set AI_STUB_DIR to a fresh absolute temp folder").toBeTruthy();
  expect(process.env.AI_STUB_ALLOW).toBe("1");
  const fixture = (key: string, value: unknown) => writeFile(join(stub!, `${key}.json`), JSON.stringify(value));
  const sql = neon(process.env.TEST_DATABASE_URL!);

  const origin = new URL(baseURL!).origin, headers = { origin };
  const [owner, stranger, anonymous] = await Promise.all([0, 1, 2].map(() => playwright.request.newContext({ baseURL: origin })));
  for (const client of [owner, stranger]) expect((await client.post("/api/workspace", { headers })).status()).toBe(201);
  async function idea(client: APIRequestContext, title: string) {
    const res = await client.post("/api/ideas", { headers: { ...headers, "Idempotency-Key": randomUUID() }, data: {
      title, description: "Help teammates choose shared meals that meet dietary requirements.",
      audience: "Hackathon teammates", problem: "Meal coordination interrupts building", workflow: "Collect requirements and choose a shared meal", constraints: null,
    } });
    expect(res.status(), "needs real HF embeddings and the current test schema").toBe(201);
    return (await res.json()) as { versionId: string; neighborIds: string[] };
  }

  // Version A with one real evidence card, so an assumption can cite it.
  const a = await idea(owner, "Hackathon meal coordination");
  const projectId = a.neighborIds[0];
  const record = await (await owner.get(`/api/projects/${projectId}`)).json();
  const quote = ([record.description, record.tagline, record.title] as (string | null)[]).find((t) => t?.trim())!.trim().slice(0, 80);
  for (const id of a.neighborIds.slice(0, 3)) {
    await fixture(`evidence-${id}`, { overlaps: [], differences: [], uncertainty: { text: "Team size is unknown.", label: "unverified", sourceIds: [] } });
  }
  expect((await owner.post(`/api/evidence/${a.versionId}`, { headers })).ok()).toBe(true);
  const outside = "f".repeat(40);
  await fixture("assumptions", { assumptions: [
    { kind: "need", assumption: { text: quote, label: "supported", sourceIds: [projectId] },
      reversal: { observe: "Ask five teams how long choosing a meal takes", reversesIf: "Most say under five minutes" }, insufficient: false },
    { kind: "data", assumption: { text: "Teammates will enter their dietary needs.", label: "inferred", sourceIds: [] },
      reversal: null, insufficient: true },
    { kind: "feasibility", assumption: { text: "A shared list can be built in one evening.", label: "inferred", sourceIds: [projectId, outside] },
      reversal: { observe: "Build the list screen in two hours", reversesIf: "It is not usable after two hours" }, insufficient: false },
  ] });

  // Validation 1: at least two kinds; each has a reversal or is insufficient, never both; claims cite only cards.
  expect((await anonymous.post(`/api/assumptions/${a.versionId}`, { headers })).status()).toBe(401);
  expect((await stranger.post(`/api/assumptions/${a.versionId}`, { headers })).status()).toBe(404);
  const first = await owner.post(`/api/assumptions/${a.versionId}`, { headers });
  expect(first.status()).toBe(200);
  const body = (await first.json()) as { versionId: string; assumptions: Item[] };
  expect(body.versionId).toBe(a.versionId);
  expect(new Set(body.assumptions.map((i) => i.kind)).size).toBeGreaterThanOrEqual(2);
  for (const i of body.assumptions) expect(i.insufficient ? i.reversal === null : i.reversal !== null).toBe(true);
  expect(body.assumptions[0].assumption).toEqual({ text: quote, label: "supported", sourceIds: [projectId] });
  expect(body.assumptions[2].assumption).toEqual({ text: "A shared list can be built in one evening.", label: "unverified", sourceIds: [projectId] });

  // A second POST returns the stored row without a model call: the fixture is gone, so a call would fail.
  await unlink(join(stub!, "assumptions.json"));
  const again = await owner.post(`/api/assumptions/${a.versionId}`, { headers });
  expect(again.status()).toBe(200);
  expect(await again.json()).toEqual(body);
  expect(await (await owner.get(`/api/assumptions/${a.versionId}`)).json()).toEqual(body);
  expect((await stranger.get(`/api/assumptions/${a.versionId}`)).status()).toBe(404);

  // Validation 2 on version B: neither, and a hedged reversal, are rejected (generate regenerates once) and dropped.
  const b = await idea(owner, "Hackathon meal coordination B");
  const neither = { kind: "feasibility", assumption: { text: "Teams have a laptop free.", label: "unverified", sourceIds: [] }, reversal: null, insufficient: false };
  const hedged = { kind: "need", assumption: { text: "Teams want help choosing.", label: "unverified", sourceIds: [] }, reversal: { observe: "maybe", reversesIf: "unclear" }, insufficient: false };
  const good = { kind: "differentiation", assumption: { text: "Group chats don't track diets.", label: "inferred", sourceIds: [] },
    reversal: { observe: "Check three group chat apps for diet fields", reversesIf: "Two of them have one" }, insufficient: false };
  await fixture("assumptions", { assumptions: [neither, hedged] });
  expect((await owner.post(`/api/assumptions/${b.versionId}`, { headers })).status(), "nothing usable: not stored").toBe(502);
  expect(await sql`select 1 from assumptions where version_id = ${b.versionId}::uuid`).toHaveLength(0);
  await fixture("assumptions", { assumptions: [neither, good, hedged] });
  const dropped = await owner.post(`/api/assumptions/${b.versionId}`, { headers });
  expect(dropped.status()).toBe(200);
  expect((await dropped.json()).assumptions).toEqual([good]);

  // Keep the stored row.
  const [row] = await sql`select to_jsonb(a) as row from assumptions a where version_id = ${a.versionId}::uuid`;
  expect(row.row.data).toEqual(body);
  await writeFile(test.info().outputPath("assumptions-row.json"), JSON.stringify(row.row, null, 2));
  await Promise.all([owner, stranger, anonymous].map((c) => c.dispose()));
});
