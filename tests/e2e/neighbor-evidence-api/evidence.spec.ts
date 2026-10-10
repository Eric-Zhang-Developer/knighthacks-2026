import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import type { Claim } from "@/lib/ai/claims";

type Card = { projectId: string; url: string; title: string; excerpt: string; overlaps: Claim[]; differences: Claim[]; uncertainty: Claim };
type Source = { id: string; url: string; title: string; description: string; tagline: string | null };
test.use({ trace: "off" }); // Session cookies must never enter the evidence report.

test("store source-bounded cards once, preserve winning rows, and load the remaining neighbors on request", async ({ playwright, baseURL }, info) => {
  test.setTimeout(180_000);
  expect(Boolean(process.env.TEST_DATABASE_URL)).toBe(true);
  expect(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL, "Both processes must use the dedicated test branch").toBe(true);
  const fixtureRoot = process.env.AI_STUB_DIR;
  expect(Boolean(fixtureRoot) && isAbsolute(fixtureRoot!), "Start the server with a fresh absolute AI_STUB_DIR").toBe(true);
  expect(process.env.AI_STUB_ALLOW).toBe("1");
  if (!baseURL || !fixtureRoot) throw new Error("Verifier URL and fixture directory are required");
  await mkdir(fixtureRoot, { recursive: true });
  const sql = neon(process.env.TEST_DATABASE_URL!);
  async function query<T>(operation: PromiseLike<T>): Promise<T> {
    try { return await operation; }
    catch { throw new Error("Evidence verification query failed on the test database"); }
  }
  async function stored(versionId: string) {
    const rows = await query(sql`select to_jsonb(c) as row from evidence_cards c where version_id = ${versionId}::uuid order by project_id`);
    return rows.map((row) => row.row);
  }
  const origin = new URL(baseURL).origin;
  const clients = await Promise.all([0, 1, 2].map(() => playwright.request.newContext({ baseURL: origin })));
  const [owner, stranger, anonymous] = clients;
  const createdWorkspaces = new Set<string>();
  const createdFixtures = new Set<string>();
  const sourceById = new Map<string, Source>();
  let retainedWorkspace: string | undefined;
  async function removeFixture(id: string) {
    const file = join(fixtureRoot!, `evidence-${id}.json`);
    if (createdFixtures.has(file)) { await unlink(file); createdFixtures.delete(file); }
  }
  try {
    const workspaceIds: string[] = [];
    for (const client of [owner, stranger]) {
      const response = await client.post("/api/workspace", { headers: { origin } });
      expect(response.status()).toBe(201);
      const { workspaceId } = await response.json();
      expect(workspaceId).toMatch(/^[0-9a-f-]{36}$/i);
      createdWorkspaces.add(workspaceId); workspaceIds.push(workspaceId);
    }
    const ideaResponse = await owner.post("/api/ideas", {
      headers: { origin, "Idempotency-Key": randomUUID() },
      data: { title: "Hackathon meal planning", description: "Coordinate shared meals around teammates' dietary constraints.", audience: "Hackathon teammates", problem: "Meal coordination interrupts building", workflow: "Collect dietary constraints and choose a shared meal", constraints: null },
    });
    expect(ideaResponse.status(), "Requires real HF embeddings and the pushed test schema").toBe(201);
    const version = await ideaResponse.json();
    const ids: string[] = version.neighborIds;
    expect(new Set(ids).size).toBe(5);
    for (const id of ids) expect(id).toMatch(/^[a-f0-9]{40}$/);
    const sources = await query(sql`select id, url, title, description, tagline from projects where id = any(array(select jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)))`);
    expect(sources).toHaveLength(5);
    const invented = `unsupported-${randomUUID()}`;
    for (const row of sources) {
      const source = row as Source;
      sourceById.set(source.id, source);
      const excerpt = (source.description.trim() ? source.description : source.tagline?.trim() ? source.tagline : source.title).slice(0, 6000);
      const quote = excerpt.trim().slice(0, 120);
      expect(quote.length).toBeGreaterThan(0);
      const anotherId = ids.find((id) => id !== source.id)!;
      const claims = {
        overlaps: [
          { text: quote, label: "supported", sourceIds: [source.id] },
          { text: quote, label: "supported", sourceIds: [source.id, anotherId] },
        ],
        differences: [
          { text: invented, label: "supported", sourceIds: [source.id] },
          { text: "This comparison still needs a user test.", label: "inferred", sourceIds: [anotherId] },
        ],
        uncertainty: { text: "This source does not establish the proposed idea's feasibility.", label: "unverified", sourceIds: [] },
      };
      const file = join(fixtureRoot, `evidence-${source.id}.json`);
      await writeFile(file, JSON.stringify(claims), { flag: "wx" }); // Never replace an existing fixture.
      createdFixtures.add(file);
    }
    const endpoint = `/api/evidence/${version.versionId}`;
    expect((await anonymous.get(endpoint)).status()).toBe(401);
    expect((await stranger.get(endpoint)).status()).toBe(404);
    expect((await stranger.post(endpoint, { headers: { origin } })).status()).toBe(404);
    const empty = await owner.get(endpoint);
    expect(empty.status()).toBe(200); expect(await empty.json()).toEqual({ cards: [] });
    const first = await owner.post(endpoint, { headers: { origin } });
    expect(first.status()).toBe(200);
    const firstBody = await first.json() as { cards: Card[] };
    expect(firstBody.cards.map((card) => card.projectId)).toEqual(ids.slice(0, 3));
    function checkCards(cards: Card[]) {
      for (const card of cards) {
        const source = sourceById.get(card.projectId)!;
        expect(card.url).toBe(source.url); expect(card.title).toBe(source.title);
        expect([source.description, source.tagline, source.title].some((text) => text?.includes(card.excerpt))).toBe(true);
        expect(card.overlaps[0].label).toBe("supported");
        expect(card.excerpt).toContain(card.overlaps[0].text);
        expect(card.overlaps[0].sourceIds).toEqual([card.projectId]);
        expect(card.overlaps[1].label).toBe("unverified");
        expect(card.differences[0]).toMatchObject({ text: invented, label: "unverified" });
        expect(card.differences[1]).toMatchObject({ label: "unverified", sourceIds: [] });
        expect(card.uncertainty.label).toBe("unverified");
        for (const claim of [...card.overlaps, ...card.differences, card.uncertainty]) {
          expect(claim.sourceIds.every((id) => id === card.projectId)).toBe(true);
        }
      }
    }
    checkCards(firstBody.cards);
    const firstRows = await stored(version.versionId);
    expect(firstRows).toHaveLength(3);
    for (const id of ids.slice(0, 3)) await removeFixture(id);
    // Fixture mode remains enabled: any regeneration now fails, with no live fallback.
    const repeat = await owner.post(endpoint, { headers: { origin } });
    expect(repeat.status()).toBe(200); expect(await repeat.json()).toEqual(firstBody);
    expect(await stored(version.versionId)).toEqual(firstRows);
    const expanded = await Promise.all([0, 1].map(() => owner.post(`${endpoint}?all=true`, { headers: { origin } })));
    expect(expanded.map((response) => response.status())).toEqual([200, 200]);
    const expandedBodies = await Promise.all(expanded.map((response) => response.json())) as { cards: Card[] }[];
    expect(expandedBodies[0]).toEqual(expandedBodies[1]);
    const complete = expandedBodies[0];
    expect(complete.cards.map((card) => card.projectId)).toEqual(ids);
    checkCards(complete.cards);
    const completeRows = await stored(version.versionId);
    expect(completeRows).toHaveLength(5);
    expect(completeRows.filter((row) => ids.slice(0, 3).includes(row.project_id))).toEqual(firstRows);
    for (const id of ids) await removeFixture(id);
    const repeatedAll = await owner.post(`${endpoint}?all=true`, { headers: { origin } });
    expect(repeatedAll.status()).toBe(200); expect(await repeatedAll.json()).toEqual(complete);
    const read = await owner.get(endpoint);
    expect(read.status()).toBe(200); expect(await read.json()).toEqual(complete);
    expect(await stored(version.versionId)).toEqual(completeRows);
    const body = JSON.stringify({ mode: "generation-fixture-real-corpus-and-database", savedVersion: version, cards: complete.cards, storedRows: completeRows, firstCount: firstRows.length, repeatWithoutFixtures: true, concurrentExpansionCounts: expandedBodies.map((result) => result.cards.length), crossWorkspaceStatus: 404, retainedWorkspace: workspaceIds[0] }, null, 2);
    await writeFile(info.outputPath("stored-evidence.json"), body);
    await info.attach("stored-evidence", { body, contentType: "application/json" });
    retainedWorkspace = workspaceIds[0]; // The spec requires keeping successful stored rows.
  } finally {
    const cleanup = await Promise.allSettled([...createdWorkspaces].filter((id) => id !== retainedWorkspace).map((id) => sql`delete from workspaces where id = ${id}::uuid`));
    const files = await Promise.allSettled([...createdFixtures].map((file) => unlink(file)));
    await Promise.allSettled(clients.map((client) => client.dispose()));
    if ([...cleanup, ...files].some((result) => result.status === "rejected")) throw new Error("Evidence cleanup failed for explicitly created test resources");
  }
});
