import { expect, test, type APIRequestContext } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

// Real server and Neon test branch; Gemini is stubbed at the provider boundary through AI_STUB_DIR (fresh, absolute).
test.use({ trace: "off" }); // session cookies never enter retained traces
const fields = { title: "Plant moisture alerts", description: "Alert a team when its office plants need water.",
  audience: "Small office teams", problem: "Plants die because nobody notices dry soil",
  workflow: "A sensor reads soil moisture and the app alerts the team", constraints: null };
const c = (text: string, label = "inferred", sourceIds: string[] = []) => ({ text, label, sourceIds });
// Identical candidates for every recommendation: only the profile differs, so any scope change is the app's assessment.
const candidates = { features: [
  { title: c("Live moisture dashboard"), demoStep: c("Show the plant's live soil reading"), reason: c("The core value"),
    requirements: { skills: ["React"], hardware: ["Raspberry Pi"], hours: 3 } },
  { title: c("Dry-soil alert"), demoStep: c("Trigger an alert by drying the sensor"), reason: c("Closes the loop"),
    requirements: { skills: [], hardware: [], hours: 2 } },
  { title: c("Watering history"), demoStep: c("Scroll back through a week of readings"), reason: c("Context"),
    requirements: { skills: [], hardware: [], hours: 4 } },
] };
const profile = (over: object) => ({ interests: [], skills: ["React"], hardware: ["Raspberry Pi 4"], hoursLeft: 10, teamSize: 3, enthusiasm: 4, ...over });

test("team profile, scope recommendations and selections persist, scope freezes into snapshots and shares", async ({ playwright, baseURL }, info) => {
  test.setTimeout(300_000);
  const stub = process.env.AI_STUB_DIR, target = process.env.TEST_DATABASE_URL!;
  expect(Boolean(target) && process.env.DATABASE_URL === target, "Dedicated test database required before writes").toBe(true);
  expect(Boolean(stub) && isAbsolute(stub!), "Start the server with a fresh absolute AI_STUB_DIR").toBe(true);
  const db = neon(target), origin = new URL(baseURL!).origin, headers = { origin };
  const [owner, stranger, anonymous] = await Promise.all([0, 1, 2].map(() => playwright.request.newContext({ baseURL: origin })));
  const opened: APIRequestContext[] = [];
  const workspaces: string[] = [];
  const evidence = async (neighborIds: string[]) => {
    for (const id of neighborIds) await writeFile(join(stub!, `evidence-${id}.json`), JSON.stringify({ overlaps: [], differences: [], uncertainty: c("Not assessed in this fixture", "unverified") }));
  };
  const save = async (ctx: APIRequestContext, data: object) => {
    const r = await ctx.post("/api/ideas", { headers: { ...headers, "Idempotency-Key": randomUUID() }, data });
    expect(r.status(), await r.text()).toBe(201);
    const v = await r.json();
    await evidence(v.neighborIds);
    return v as { versionId: string; ideaId: string; neighborIds: string[] };
  };
  const log: Record<string, unknown> = {};
  try {
    for (const ctx of [owner, stranger]) {
      const r = await ctx.post("/api/workspace", { headers });
      expect(r.status()).toBe(201);
      workspaces.push((await r.json()).workspaceId);
    }

    // Validation 1: profile persists per workspace, reopens with the same cookie, and a stale write is a 409.
    expect((await anonymous.get("/api/decision-context/profile")).status()).toBe(401);
    expect(await (await owner.get("/api/decision-context/profile")).json()).toEqual({ profileRevision: 0, profile: null });
    const p1 = profile({ interests: ["plants"] });
    const put1 = await owner.put("/api/decision-context/profile", { headers, data: { expectedRevision: 0, profile: p1 } });
    expect(put1.status(), await put1.text()).toBe(200);
    expect(await put1.json()).toEqual({ profileRevision: 1, profile: p1 });
    const reopened = await playwright.request.newContext({ baseURL: origin, storageState: await owner.storageState() });
    opened.push(reopened);
    expect(await (await reopened.get("/api/decision-context/profile")).json()).toEqual({ profileRevision: 1, profile: p1 });
    expect(await (await stranger.get("/api/decision-context/profile")).json()).toEqual({ profileRevision: 0, profile: null });
    expect((await stranger.put("/api/decision-context/profile", { headers, data: { expectedRevision: 1, profile: p1 } })).status()).toBe(409);
    expect((await owner.put("/api/decision-context/profile", { data: { expectedRevision: 1, profile: p1 } })).status()).toBe(403); // cross-origin
    const race = await Promise.all([0, 1].map(() => owner.put("/api/decision-context/profile", { headers, data: { expectedRevision: 1, profile: profile({}) } })));
    expect(race.map((r) => r.status()).sort()).toEqual([200, 409]);
    expect((await (await owner.get("/api/decision-context/profile")).json()).profileRevision).toBe(2);

    // Validation 2: identical candidates; less time and no Raspberry Pi change the affected scopes, in app code.
    const v1 = await save(owner, fields);
    await writeFile(join(stub!, `scope-${v1.versionId}.json`), JSON.stringify(candidates));
    const recPath = `/api/decision-context/versions/${v1.versionId}/recommendations`;
    expect(await (await owner.get(`/api/decision-context/versions/${v1.versionId}`)).json()).toEqual({ recommendation: null, selection: null });
    const roomy = await owner.post(recPath, { headers, data: { profileRevision: 2 } });
    expect(roomy.status(), await roomy.text()).toBe(201);
    const recA = await roomy.json();
    expect(recA.features.map((f: { recommendedScope: string }) => f.recommendedScope)).toEqual(["core", "core", "core"]);
    const p3 = profile({ hardware: ["Laptop"], hoursLeft: 3.5 });
    expect((await owner.put("/api/decision-context/profile", { headers, data: { expectedRevision: 2, profile: p3 } })).status()).toBe(200);
    const tight = await owner.post(recPath, { headers, data: { profileRevision: 3 } });
    expect(tight.status()).toBe(201);
    const recB = await tight.json();
    expect(recB.features.map((f: { recommendedScope: string }) => f.recommendedScope)).toEqual(["later", "core", "later"]);
    expect(recB.features[0].profileInfluences).toContainEqual({ field: "hardware", value: ["Laptop"], tradeoff: expect.stringContaining("Raspberry Pi") });
    expect(recB.features[2].profileInfluences).toContainEqual({ field: "hoursLeft", value: 3.5, tradeoff: expect.stringContaining("more than the 3.5 h left") });
    expect(recB.features[1].profileInfluences.length).toBeGreaterThan(0); // unchanged, and says why
    expect(new Set(recB.features.map((f: { id: string }) => f.id)).size).toBe(3);
    expect((await owner.post(recPath, { headers, data: { profileRevision: 9 } })).status()).toBe(409);
    expect((await stranger.post(recPath, { headers, data: { profileRevision: 0 } })).status()).toBe(404);
    log.recommendations = { roomy: recA, tight: recB };

    // Validation 3: choices persist; foreign, duplicate, missing and wrong-version ids are rejected; races can't overwrite.
    const selPath = `/api/decision-context/versions/${v1.versionId}/selections`;
    const [a, b, d] = recB.features.map((f: { id: string }) => f.id);
    const choices = [{ featureId: a, scope: "optional" }, { featureId: b, scope: "core" }, { featureId: d, scope: "later" }];
    const bad = [
      [{ featureId: a, scope: "core" }, { featureId: a, scope: "core" }, { featureId: d, scope: "core" }],
      [{ featureId: a, scope: "core" }],
      [{ featureId: a, scope: "later" }, { featureId: b, scope: "optional" }, { featureId: d, scope: "later" }],
    ];
    for (const ch of bad) expect((await owner.post(selPath, { headers, data: { recommendationId: recB.recommendationId, expectedSelectionRevision: 0, choices: ch } })).status()).toBe(400);
    expect((await stranger.post(selPath, { headers, data: { recommendationId: recB.recommendationId, expectedSelectionRevision: 0, choices } })).status()).toBe(404);
    const other = await save(owner, { ...fields, title: "Plant swap board", workflow: "Teams list cuttings to swap" });
    expect((await owner.post(`/api/decision-context/versions/${other.versionId}/selections`, { headers, data: { recommendationId: recB.recommendationId, expectedSelectionRevision: 0, choices } })).status()).toBe(400);
    const first = await owner.post(selPath, { headers, data: { recommendationId: recB.recommendationId, expectedSelectionRevision: 0, choices } });
    expect(first.status(), await first.text()).toBe(201);
    const sel1 = await first.json();
    expect(sel1).toMatchObject({ selectionRevision: 1, versionId: v1.versionId, recommendationId: recB.recommendationId, choices });
    expect(sel1.demoSketch).toEqual([recB.features[1].demoStep]);
    const swap = [{ featureId: a, scope: "core" }, { featureId: b, scope: "core" }, { featureId: d, scope: "later" }];
    const raced = await Promise.all([choices, swap].map((ch) => owner.post(selPath, { headers, data: { recommendationId: recB.recommendationId, expectedSelectionRevision: 1, choices: ch } })));
    expect(raced.map((r) => r.status()).sort()).toEqual([201, 409]);
    const ctx = await (await reopened.get(`/api/decision-context/versions/${v1.versionId}`)).json();
    expect(ctx.recommendation).toEqual(recB);
    expect(ctx.selection).toMatchObject({ selectionRevision: 2, recommendationId: recB.recommendationId, profileRevision: 3 });
    expect(await (await owner.get(`/api/decision-context/versions/${other.versionId}`)).json()).toEqual({ recommendation: null, selection: null });
    expect((await stranger.get(`/api/decision-context/versions/${v1.versionId}`)).status()).toBe(404);

    // Validation 4: the snapshot freezes this scope; later changes leave its bytes alone; shares carry it, privately.
    const snap1 = await owner.post("/api/snapshots", { headers, data: { versionId: v1.versionId }, timeout: 120_000 });
    expect(snap1.status(), await snap1.text()).toBe(201);
    const { snapshotId: s1 } = await snap1.json();
    const before = await (await owner.get(`/api/snapshots/${s1}`)).text();
    const frozen = JSON.parse(before);
    expect(frozen.scope).toEqual({ selectionId: ctx.selection.selectionId,
      features: recB.features.map((f: { id: string; title: unknown; demoStep: unknown }) => ({ id: f.id, title: f.title, demoStep: f.demoStep })),
      choices: ctx.selection.choices, demoSketch: ctx.selection.demoSketch });
    for (const secret of ["profileInfluences", "hoursLeft", "Laptop", "requirements", "gaps"]) expect(before).not.toContain(secret);

    const p4 = profile({ hoursLeft: 12 });
    expect((await owner.put("/api/decision-context/profile", { headers, data: { expectedRevision: 3, profile: p4 } })).status()).toBe(200);
    const recC = await (await owner.post(recPath, { headers, data: { profileRevision: 4 } })).json();
    const allCore = recC.features.map((f: { id: string }) => ({ featureId: f.id, scope: "core" }));
    expect((await owner.post(selPath, { headers, data: { recommendationId: recC.recommendationId, expectedSelectionRevision: 2, choices: allCore } })).status()).toBe(201);
    await writeFile(join(stub!, "revision-propose.json"), readFileSync(join(__dirname, "fixtures", "revision-propose.json")));
    const proposed = await owner.post("/api/revisions/propose", { headers, data: { versionId: v1.versionId } });
    expect(proposed.status(), await proposed.text()).toBe(200);
    const accepted = await owner.post(`/api/revisions/${(await proposed.json()).suggestions[0].id}/accept`, { headers });
    expect([200, 201]).toContain(accepted.status());
    expect(await (await owner.get(`/api/snapshots/${s1}`)).text()).toBe(before); // byte-identical

    const s2 = (await (await owner.post("/api/snapshots", { headers, data: { versionId: v1.versionId }, timeout: 120_000 })).json()).snapshotId;
    const second = await (await owner.get(`/api/snapshots/${s2}`)).json();
    expect(second.scope.demoSketch).toEqual(recC.features.map((f: { demoStep: unknown }) => f.demoStep));
    const share = await owner.post("/api/shares", { headers, data: { snapshotId: s2 } });
    expect(share.status()).toBe(201);
    const { token } = await share.json();
    const publicRead = await anonymous.get(`/api/shares/${token}`);
    expect(publicRead.status()).toBe(200);
    const publicText = await publicRead.text();
    expect(JSON.parse(publicText).scope).toEqual(second.scope);
    for (const secret of ["profileInfluences", "hoursLeft", "requirements", "gaps"]) expect(publicText).not.toContain(secret);
    expect((await owner.delete(`/api/shares/${token}`, { headers })).status()).toBe(204);
    expect((await anonymous.get(`/api/shares/${token}`)).status()).toBe(410);

    // A version with no saved scope snapshots exactly as before: no scope key at all.
    const legacy = (await (await owner.post("/api/snapshots", { headers, data: { versionId: other.versionId }, timeout: 120_000 })).json()).snapshotId;
    expect(Object.keys(await (await owner.get(`/api/snapshots/${legacy}`)).json())).not.toContain("scope");

    log.selection = ctx.selection;
    log.snapshots = { frozen: s1, second: s2, legacy };
    log.rows = await db`select 'scope_recommendations' as t, id from scope_recommendations where version_id = ${v1.versionId}::uuid
      union all select 'scope_selections', id from scope_selections where version_id = ${v1.versionId}::uuid`;
    await writeFile(info.outputPath("decision-context.json"), JSON.stringify(log, null, 2));
  } finally {
    for (const id of workspaces) await db`delete from workspaces where id = ${id}::uuid`;
    await Promise.all([owner, stranger, anonymous, ...opened].map((x) => x.dispose()));
  }
});
