import { expect, test } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

// Real server and Neon test branch; Gemini stubbed through AI_STUB_DIR. The summary-only project is a clearly fictional
// test fixture (example.test URL, "test fixture" title) with an empty description, removed afterwards. It copies a
// real neighbour's embedding so a second save of the same idea finds it as a neighbour; no saved version is edited.
test.use({ trace: "off" }); // session cookies never enter retained traces
const fields = { title: "Shared office plant watering rota", description: "A rota app so office teams take turns watering shared plants.",
  audience: "Office teams", problem: "Shared plants dry out because nobody owns watering", workflow: "Each person gets a watering day and a reminder", constraints: null };
type Card = { projectId: string; excerpt: string; excerptSource: string };
type Hit = { id: string; summaryOnly?: boolean };

test("summary-only neighbours: evidence says where each excerpt came from, and search marks them", async ({ playwright, baseURL }, info) => {
  test.setTimeout(240_000);
  const stub = process.env.AI_STUB_DIR, target = process.env.TEST_DATABASE_URL!;
  expect(Boolean(target) && process.env.DATABASE_URL === target, "Dedicated test database required before writes").toBe(true);
  expect(Boolean(stub) && isAbsolute(stub!), "Start the server with a fresh absolute AI_STUB_DIR").toBe(true);
  const db = neon(target), origin = new URL(baseURL!).origin, headers = { origin };
  const owner = await playwright.request.newContext({ baseURL: origin });
  const marker = `zz-summary-only-${randomBytes(4).toString("hex")}`;
  const fixtureId = randomBytes(20).toString("hex");
  let workspaceId: string | null = null;
  const save = async () => {
    const r = await owner.post("/api/ideas", { headers: { ...headers, "Idempotency-Key": randomUUID() }, data: fields });
    expect(r.status(), await r.text()).toBe(201);
    return (await r.json()) as { versionId: string; neighborIds: string[] };
  };
  try {
    const ws = await owner.post("/api/workspace", { headers });
    expect(ws.status()).toBe(201);
    workspaceId = (await ws.json()).workspaceId;
    const first = await save();
    const [n1] = first.neighborIds;
    const inserted = await db`insert into projects (id, url, title, tagline, description, technologies, events, date, date_kind, source, fetched_at, content_hash, embedding, x, y, z, corpus_version)
      select ${fixtureId}, ${`https://example.test/${marker}`}, ${`Summary-only test fixture ${marker}`}, ${`Test-only gallery card ${marker}`}, '',
        '[]'::jsonb, '[]'::jsonb, null, 'unknown', 'test-fixture', now(), md5(${marker}), embedding, x, y, z, corpus_version
      from projects where id = ${n1} returning id`;
    expect(inserted).toHaveLength(1);

    // The same idea saved again finds the fixture as a neighbour (it ties with n1).
    const second = await save();
    expect(second.neighborIds).toContain(fixtureId);
    for (const id of second.neighborIds)
      await writeFile(join(stub!, `evidence-${id}.json`), JSON.stringify({ overlaps: [], differences: [], uncertainty: { text: "Not assessed in this fixture", label: "unverified", sourceIds: [] } }));

    // Validation 1: the real generation path stores cards; each says where its excerpt came from.
    const made = await owner.post(`/api/evidence/${second.versionId}?all=true`, { headers, timeout: 120_000 });
    expect(made.status(), await made.text()).toBe(200);
    const cards = (await made.json()).cards as Card[];
    const fixtureCard = cards.find((c) => c.projectId === fixtureId)!;
    expect(fixtureCard).toMatchObject({ excerpt: `Test-only gallery card ${marker}`, excerptSource: "tagline" });
    const full = await db`select id from projects where id = any(${second.neighborIds}) and btrim(description) <> ''`;
    expect(full.length).toBeGreaterThan(0);
    for (const { id } of full) expect(cards.find((c) => c.projectId === id)!.excerptSource, String(id)).toBe("description");

    // The project's text changes after the card was saved: it reloads as "unknown", never a guess.
    await db`update projects set tagline = ${`Changed gallery card ${marker}`} where id = ${fixtureId}`;
    const reread = (await (await owner.get(`/api/evidence/${second.versionId}`)).json()).cards as Card[];
    expect(reread.find((c) => c.projectId === fixtureId)!.excerptSource).toBe("unknown");
    expect(reread.find((c) => c.projectId === full[0].id)!.excerptSource).toBe("description");

    // Validation 2: search marks the summary-only hit; a full project's hit is false.
    const found = await (await owner.get(`/api/search?q=${encodeURIComponent(marker)}`)).json();
    expect((found.textMatches as Hit[]).find((h) => h.id === fixtureId)?.summaryOnly).toBe(true);
    const fullTitle = (await db`select title from projects where id = ${full[0].id}`)[0].title as string;
    const other = await (await owner.get(`/api/search?q=${encodeURIComponent(fullTitle.slice(0, 200))}`)).json();
    expect((other.textMatches as Hit[]).find((h) => h.id === full[0].id)?.summaryOnly).toBe(false);
    for (const h of [...(found.results as Hit[]), ...(other.results as Hit[])]) expect(typeof h.summaryOnly).toBe("boolean");

    await writeFile(info.outputPath("summary-records.json"), JSON.stringify({ fixtureId, cards: cards.map(({ projectId, excerptSource }) => ({ projectId, excerptSource })),
      reread: reread.map(({ projectId, excerptSource }) => ({ projectId, excerptSource })), search: { fixture: found.textMatches, full: other.textMatches.slice(0, 3) } }, null, 2));
  } finally {
    if (workspaceId) await db`delete from workspaces where id = ${workspaceId}::uuid`;
    await db`delete from projects where id = ${fixtureId}`;
    await owner.dispose();
  }
});
