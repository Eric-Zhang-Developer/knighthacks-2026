import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import type { Combinations } from "@/lib/combinations/contract";
test.use({ trace: "off", video: "off" });
test("stored source pairs survive malformed siblings, concurrency and fixture removal", async ({ playwright, baseURL }, info) => {
  test.setTimeout(210000);
  expect(Boolean(process.env.TEST_DATABASE_URL)).toBe(true); expect(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL).toBe(true);
  const fixtures = process.env.AI_STUB_DIR;
  expect(Boolean(fixtures) && isAbsolute(fixtures!)).toBe(true); expect(process.env.AI_STUB_ALLOW).toBe("1");
  if (!fixtures || !baseURL) throw new Error("Fresh fixture directory and app required");
  await mkdir(fixtures, { recursive: true });
  const fixturePath = join(fixtures, "combinations.json"); let fixtureCreated = false, retained: string | undefined;
  const created = new Set<string>(), sql = neon(process.env.TEST_DATABASE_URL!);
  async function query<T>(operation: PromiseLike<T>) { try { return await operation; } catch { throw new Error("Combinations test database query failed"); } }
  const origin = new URL(baseURL).origin, headers = { origin };
  const clients = await Promise.all([0, 1, 2].map(() => playwright.request.newContext({ baseURL: origin })));
  const [owner, stranger, anonymous] = clients;
  try {
    const workspaces: string[] = [];
    for (const client of [owner, stranger]) {
      const response = await client.post("/api/workspace", { headers }); expect(response.status()).toBe(201);
      const id = (await response.json()).workspaceId as string; expect(id).toMatch(/^[a-f0-9-]{36}$/i); created.add(id); workspaces.push(id);
    }
    const save = async () => {
      const response = await owner.post("/api/ideas", { headers: { ...headers, "Idempotency-Key": randomUUID() }, data: {
        title: "Hackathon meal coordination", description: "Help teammates choose a shared meal", audience: "Hackathon teams", problem: "Meal coordination interrupts building", workflow: "Collect dietary requirements and choose a shared meal", constraints: null,
      } }); expect(response.status()).toBe(201); return response.json();
    };
    const version = await save();
    const records = await query(sql`select "id", "title", "url", "description", "tagline" from "projects" where "corpus_version" = ${version.corpusVersion} and "id" = any(array(select jsonb_array_elements_text(${JSON.stringify(version.neighborIds)}::jsonb)))`);
    expect(records).toHaveLength(5);
    const [a, b, c] = version.neighborIds as string[];
    const source = records.find((row) => row.id === a)!;
    const excerpt = [source.description, source.tagline, source.title].find((text) => typeof text === "string" && text.trim()) as string;
    const quote = excerpt.slice(0, 6000).trim().slice(0, 120);
    const valid = { user: "Hackathon teammates", benefit: { text: "The proposed workflow could simplify a shared decision", label: "inferred", sourceIds: [a, b] }, workflow: ["Collect dietary requirements", "Choose a shared meal"], sourceIds: [a, b], claims: [{ text: quote, label: "supported", sourceIds: [a] }, { text: "Not verified by the selected pair", label: "supported", sourceIds: [a, c] }] };
    await writeFile(fixturePath, JSON.stringify({ suggestions: [valid, { ...valid, sourceIds: [a, b, c] }, { ...valid, sourceIds: [a, "outside"] }] }), { flag: "wx" }); fixtureCreated = true;
    const path = `/api/combinations/${version.versionId}`;
    expect((await anonymous.post(path, { headers })).status()).toBe(401); expect((await stranger.post(path, { headers })).status()).toBe(404);
    expect((await owner.post(path, { headers: { origin: "https://foreign.test" } })).status()).toBe(403);
    expect((await owner.get(path)).status()).toBe(404);
    const responses = await Promise.all([owner.post(path, { headers }), owner.post(path, { headers })]);
    expect(responses.map((response) => response.status())).toEqual([200, 200]);
    const bodies: Combinations[] = await Promise.all(responses.map((response) => response.json())); expect(bodies[0]).toEqual(bodies[1]);
    const result = bodies[0]; expect(result.suggestions).toHaveLength(1); const suggestion = result.suggestions[0];
    expect(suggestion.sources).toEqual([a, b].map((id) => { const row = records.find((record) => record.id === id)!; return { projectId: id, title: row.title, url: row.url }; }));
    expect(suggestion.user).toBeTruthy(); expect(suggestion.workflow.length).toBeGreaterThan(0); expect(suggestion.workflowIsProposal).toBe(true);
    expect(suggestion.claims[0]).toEqual({ text: quote, label: "supported", sourceIds: [a] }); expect(suggestion.claims[1]).toMatchObject({ label: "unverified", sourceIds: [a] });
    for (const claim of [suggestion.benefit, ...suggestion.claims]) { expect(["supported", "inferred", "unverified"]).toContain(claim.label); expect(claim.sourceIds.every((id) => [a, b].includes(id))).toBe(true); }
    const before = await query(sql`select "data", "source_excerpts", "created_at" from "combinations" where "version_id" = ${version.versionId}::uuid`); expect(before).toHaveLength(1);
    await unlink(fixturePath); fixtureCreated = false;
    const repeat = await owner.post(path, { headers }), get = await owner.get(path); expect(repeat.status()).toBe(200); expect(get.status()).toBe(200);
    expect(await repeat.json()).toEqual(result); expect(await get.json()).toEqual(result); expect((await stranger.get(path)).status()).toBe(404);
    expect(await query(sql`select "data", "source_excerpts", "created_at" from "combinations" where "version_id" = ${version.versionId}::uuid`)).toEqual(before);
    const emptyVersion = await save();
    await writeFile(fixturePath, JSON.stringify({ suggestions: [{ user: "Missing everything else" }] }), { flag: "wx" }); fixtureCreated = true;
    const empty = await owner.post(`/api/combinations/${emptyVersion.versionId}`, { headers }); expect(empty.status()).toBe(200);
    expect(await empty.json()).toEqual({ versionId: emptyVersion.versionId, suggestions: [] });
    await writeFile(info.outputPath("combinations.json"), JSON.stringify({ workspaceId: workspaces[0], versionId: version.versionId, result, statuses: responses.map((response) => response.status()), emptyVersionId: emptyVersion.versionId, retained: true }, null, 2));
    retained = workspaces[0];
  } finally {
    const outcomes = await Promise.allSettled([
      ...(fixtureCreated ? [unlink(fixturePath)] : []),
      ...[...created].filter((id) => id !== retained).map((id) => query(sql`delete from "workspaces" where "id" = ${id}::uuid`)),
      ...clients.map((client) => client.dispose()),
    ]);
    if (outcomes.some((outcome) => outcome.status === "rejected")) throw new Error("Combinations cleanup failed for this test's exact workspace IDs or owned fixture");
  }
});

