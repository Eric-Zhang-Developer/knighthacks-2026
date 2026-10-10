import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
const CRITERIA = ["Originality", "Technical Understanding", "Functionality", "Design", "Wow Factor"];
import type { Card } from "@/lib/evidence/contract";
// Only generation is stubbed. Use real HF, HTTP and test Neon; retain created rows and omit cookie traces.
test.use({ trace: "off" });
test("compare two and three versions using their saved evidence without numeric scores or mutations", async ({ playwright, baseURL }, info) => {
  test.setTimeout(240_000);
  expect(process.env.TEST_DATABASE_URL).toBeTruthy();
  expect(process.env.DATABASE_URL).toBe(process.env.TEST_DATABASE_URL);
  const fixtures = process.env.AI_STUB_DIR!;
  expect(isAbsolute(fixtures)).toBe(true); expect(process.env.AI_STUB_ALLOW).toBe("1");
  await mkdir(fixtures, { recursive: true });
  const sql = neon(process.env.TEST_DATABASE_URL!);
  const origin = new URL(baseURL!).origin, headers = { origin };
  const clients = await Promise.all([0, 1, 2].map(() => playwright.request.newContext({ baseURL: origin })));
  const [owner, stranger, anonymous] = clients;
  const ids: string[] = [], cards: Card[][] = [];
  try {
    for (const client of [owner, stranger]) expect((await client.post("/api/workspace", { headers })).status()).toBe(201);
    for (const title of ["Hackathon meal planning", "Event food coordination", "Dietary preferences for teams"]) {
      const saved = await owner.post("/api/ideas", { headers: { ...headers, "Idempotency-Key": randomUUID() }, data: {
        title, description: "A fictional test idea for planning team meals.", audience: "Hackathon teams", problem: "Meal coordination",
        workflow: "Choose a shared meal", constraints: null } });
      expect(saved.status()).toBe(201); const version = await saved.json(); ids.push(version.versionId);
      if (ids.length === 3) { cards.push([]); continue; }
      const sources = await sql`select id, description, tagline, title from projects where id = any(array(select jsonb_array_elements_text(${JSON.stringify(version.neighborIds)}::jsonb)))`;
      for (const source of sources) {
        const excerpt = [source.description, source.tagline, source.title].find((s) => typeof s === "string" && s.trim()) as string;
        await writeFile(join(fixtures, `evidence-${source.id}.json`), JSON.stringify({
          overlaps: [{ text: excerpt.slice(0, 120), label: "supported", sourceIds: [source.id] }], differences: [],
          uncertainty: { text: "Feasibility needs a working prototype", label: "unverified", sourceIds: [] } }));
      }
      const evidence = await owner.post(`/api/evidence/${version.versionId}`, { headers });
      expect(evidence.status()).toBe(200); cards.push((await evidence.json()).cards);
    }
    const before = await sql`select to_jsonb(v) as row from idea_versions v where id = any(array(select jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb))::uuid[]) order by id`;
    const beforeCards = await sql`select to_jsonb(c) as row from evidence_cards c where version_id = any(array(select jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb))::uuid[]) order by version_id, project_id`;
    const results = [];
    for (const selection of [ids.slice(0, 2), ids]) {
      const fixture = { criteria: CRITERIA.map((name) => ({ name, perVersion: selection.map((versionId, i) => ({ versionId,
        reason: { text: "The proposed workflow needs validation against the saved evidence", label: "inferred", sourceIds: cards[i].length ? [cards[i][0].projectId] : [] },
        uncertainty: "Implementation quality and user demand remain unknown" })) })) };
      await writeFile(join(fixtures, "compare.json"), JSON.stringify(fixture));
      const response = await owner.post("/api/compare", { headers, data: { versionIds: selection } });
      expect(response.status()).toBe(200); const result = await response.json(); results.push(result);
      expect(result.criteria.map((c: { name: string }) => c.name)).toEqual(CRITERIA);
      for (const c of result.criteria) {
        expect(c.perVersion.map((v: { versionId: string }) => v.versionId)).toEqual(selection);
        for (const [i, v] of c.perVersion.entries()) {
          expect(v.reason.label).toBe("inferred"); expect(v.reason.text).toBeTruthy(); expect(v.uncertainty).toBeTruthy();
          expect(v.reason.text + v.uncertainty).not.toMatch(/\p{N}/u);
          expect(v.reason.sourceIds).toEqual(cards[i].length ? [cards[i][0].projectId] : []);
        }
      }
      function noNumbers(value: unknown) { expect(typeof value).not.toBe("number");
        if (value && typeof value === "object") Object.values(value).forEach(noNumbers); }
      noNumbers(result);
    }
    expect((await anonymous.post("/api/compare", { headers, data: { versionIds: ids } })).status()).toBe(401);
    expect((await stranger.post("/api/compare", { headers, data: { versionIds: ids } })).status()).toBe(404);
    expect((await owner.post("/api/compare", { headers, data: { versionIds: [ids[0], ids[0]] } })).status()).toBe(400);
    expect(await sql`select to_jsonb(v) as row from idea_versions v where id = any(array(select jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb))::uuid[]) order by id`).toEqual(before);
    expect(await sql`select to_jsonb(c) as row from evidence_cards c where version_id = any(array(select jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb))::uuid[]) order by version_id, project_id`).toEqual(beforeCards);
    await writeFile(info.outputPath("comparisons.json"), JSON.stringify({ versionIds: ids, results, cards }, null, 2));
  } finally { await Promise.all(clients.map((c) => c.dispose())); }
});
