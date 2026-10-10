import { createHash, randomBytes, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";

test.use({ trace: "off" }); // Session cookies and share capabilities must not enter reports.

test("restore persisted workspace rows, isolate another workspace, and revoke a listed share", async ({ playwright, browser, baseURL }, info) => {
  test.setTimeout(150_000);
  expect(Boolean(process.env.TEST_DATABASE_URL)).toBe(true);
  expect(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL).toBe(true);
  expect(process.env.AI_STUB_ALLOW).toBe("1");
  if (!baseURL) throw new Error("Verifier URL required");
  const sql = neon(process.env.TEST_DATABASE_URL!);
  async function query<T>(operation: PromiseLike<T>): Promise<T> {
    try { return await operation; } catch { throw new Error("Workspace restore query failed on TEST Neon"); }
  }
  const origin = new URL(baseURL).origin, headers = { origin };
  const clients = await Promise.all([0, 1, 2].map(() => playwright.request.newContext({ baseURL: origin })));
  const [owner, stranger, anonymous] = clients;
  const workspaces: string[] = [];
  const publicBrowser = await browser.newContext();
  try {
    for (const client of [owner, stranger]) {
      const response = await client.post("/api/workspace", { headers });
      expect(response.status()).toBe(201);
      workspaces.push((await response.json()).workspaceId);
    }
    expect((await anonymous.get("/api/workspace/state")).status()).toBe(401);
    const empty = await stranger.get("/api/workspace/state");
    expect(empty.status()).toBe(200);
    expect(await empty.json()).toEqual({ ideas: [], challenges: [], snapshots: [], shares: [] });

    // Deterministic fictional state fixtures: restoring existing rows needs no provider or corpus call.
    const ideaIds = [randomUUID(), randomUUID(), randomUUID()];
    const versionIds = ideaIds.map(() => randomUUID());
    const vector = JSON.stringify([1, ...Array<number>(1023).fill(0)]);
    for (const [i, ideaId] of ideaIds.entries()) {
      await query(sql`insert into ideas(id,workspace_id,idempotency_key) values
        (${ideaId}::uuid,${workspaces[i === 2 ? 1 : 0]}::uuid,${randomUUID()})`);
      await query(sql`insert into idea_versions(id,idea_id,title,description,audience,problem,workflow,constraints,
        embedding,x,y,z,neighbor_ids,corpus_version) values (${versionIds[i]}::uuid,${ideaId}::uuid,
        ${`Fictional restore fixture ${i}`},'Stored description','Test teammates','Stored problem','Stored workflow',null,
        ${vector}::vector,0,0,0,array[]::text[],'test-fixture')`);
    }
    const olderSession = randomUUID(), sessionId = randomUUID(), foreignSession = randomUUID();
    await query(sql`insert into challenge_sessions(id,version_id,perspective,round_count,state,created_at) values
      (${olderSession}::uuid,${versionIds[0]}::uuid,'user',0,'idle',now()-interval '1 minute'),
      (${sessionId}::uuid,${versionIds[0]}::uuid,'judge',1,'idle',now()),
      (${foreignSession}::uuid,${versionIds[2]}::uuid,'engineer',0,'idle',now())`);
    const source = { text: "Proposed test: ask a teammate to try the workflow", label: "unverified", sourceIds: [] };
    await query(sql`insert into challenge_rounds(session_id,round,status,question,assumption,source,answer,outcome) values
      (${sessionId}::uuid,1,'answered','Can a teammate complete the workflow?','The workflow is understandable',
      ${JSON.stringify(source)}::jsonb,'We have not tested it','test')`);
    const snapshotId = randomUUID(), foreignSnapshot = randomUUID();
    const frozen = { versionId: versionIds[0], idea: { title: "Fictional frozen decision", description: null,
      problem: null, workflow: null, constraints: null }, audience: null, nearestAlternatives: [], whatDiffers: [],
      mainUncertainty: null, nextTest: null };
    await query(sql`insert into snapshots(id,workspace_id,data) values
      (${snapshotId}::uuid,${workspaces[0]}::uuid,${JSON.stringify(frozen)}::jsonb),
      (${foreignSnapshot}::uuid,${workspaces[1]}::uuid,${JSON.stringify({ ...frozen, versionId: versionIds[2] })}::jsonb)`);
    const tokens = [0, 1, 2].map(() => randomBytes(16).toString("base64url"));
    const hashes = tokens.map((token) => createHash("sha256").update(token).digest("hex"));
    for (const [i, hash] of hashes.entries()) await query(sql`insert into shares(token_hash,snapshot_id) values
      (${hash},${i === 2 ? foreignSnapshot : snapshotId}::uuid)`);

    const response = await owner.get("/api/workspace/state");
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    const text = await response.text(), state = JSON.parse(text);
    for (const secret of [...tokens, ...hashes]) expect(text.includes(secret)).toBe(false);
    expect(Object.keys(state).sort()).toEqual(["challenges", "ideas", "shares", "snapshots"]);
    const listedIdeas = await (await owner.get("/api/ideas")).json();
    expect([...state.ideas].sort((a, b) => a.ideaId.localeCompare(b.ideaId))).toEqual(
      [...listedIdeas].sort((a, b) => a.ideaId.localeCompare(b.ideaId)));
    expect(state.ideas).toHaveLength(2);
    expect(state.challenges).toEqual([{ versionId: versionIds[0], sessionId, perspective: "judge", state: "idle",
      rounds: [{ round: 1, status: "answered", question: "Can a teammate complete the workflow?",
        assumption: "The workflow is understandable", source, answer: "We have not tested it", outcome: "test" }] }]);
    expect(state.snapshots).toEqual([{ id: snapshotId, versionId: versionIds[0], createdAt: expect.any(String) }]);
    expect(state.shares).toHaveLength(2);
    expect(state.shares.map((s: { id: string }) => s.id).sort()).toEqual(hashes.slice(0, 2).map((s) => s.slice(0, 16)).sort());
    for (const share of state.shares) expect(share).toEqual({ id: expect.stringMatching(/^[0-9a-f]{16}$/),
      snapshotId, createdAt: expect.any(String), revokedAt: null });
    const foreignResponse = await stranger.get("/api/workspace/state");
    expect(foreignResponse.status()).toBe(200);
    const foreign = await foreignResponse.json();
    expect(foreign.ideas.map((v: { ideaId: string }) => v.ideaId)).toEqual([ideaIds[2]]);
    expect(foreign.challenges.map((s: { sessionId: string }) => s.sessionId)).toEqual([foreignSession]);
    expect(foreign.snapshots.map((s: { id: string }) => s.id)).toEqual([foreignSnapshot]);
    expect(foreign.shares.map((s: { id: string }) => s.id)).toEqual([hashes[2].slice(0, 16)]);

    const revokePath = `/api/workspace/shares/${hashes[0].slice(0, 16)}/revoke`;
    expect((await anonymous.post(revokePath, { headers })).status()).toBe(401);
    expect((await stranger.post(revokePath, { headers })).status()).toBe(404);
    expect((await owner.post(revokePath, { headers: { origin: "https://foreign.invalid" } })).status()).toBe(403);
    expect((await owner.post("/api/workspace/shares/not-an-id/revoke", { headers })).status()).toBe(404);
    expect((await anonymous.get(`/api/shares/${tokens[0]}`)).status()).toBe(200);
    const revoked = await Promise.all([0, 1].map(() => owner.post(revokePath, { headers })));
    for (const result of revoked) expect(result.status()).toBe(200);
    const first = await revoked[0].json();
    expect(first).toEqual({ revokedAt: expect.any(String) });
    expect(await revoked[1].json()).toEqual(first);
    const repeated = await owner.post(revokePath, { headers });
    expect(repeated.status()).toBe(200); expect(await repeated.json()).toEqual(first);
    expect((await anonymous.get(`/api/shares/${tokens[0]}`)).status()).toBe(410);
    expect((await anonymous.get(`/api/shares/${tokens[1]}`)).status()).toBe(200);
    const page = await publicBrowser.newPage();
    await page.goto(`${origin}/s/${tokens[0]}`);
    await expect(page.locator('[data-share-state="revoked"]')).toHaveText("This link was revoked by its owner.");
    const restored = await (await owner.get("/api/workspace/state")).json();
    expect(restored.shares.find((s: { id: string }) => s.id === hashes[0].slice(0, 16)).revokedAt).toBe(first.revokedAt);

    // Exercise the actual SQL caps and joins, including a new share of an older snapshot outside its list cap.
    const bulk = Array.from({ length: 51 }, () => ({ idea: randomUUID(), version: randomUUID(), session: randomUUID(),
      snapshot: randomUUID(), hash: randomBytes(32).toString("hex") }));
    await query(sql`with fixture as (select * from jsonb_to_recordset(${JSON.stringify(bulk)}::jsonb)
      as f(idea uuid,version uuid,session uuid,snapshot uuid,hash text)),
      inserted_ideas as (insert into ideas(id,workspace_id,idempotency_key)
        select idea,${workspaces[0]}::uuid,idea::text from fixture returning id),
      inserted_versions as (insert into idea_versions(id,idea_id,title,embedding,x,y,z,neighbor_ids,corpus_version)
        select f.version,f.idea,'Fictional capped restore fixture',${vector}::vector,0,0,0,array[]::text[],'test-fixture'
        from fixture f join inserted_ideas i on i.id=f.idea returning id),
      inserted_sessions as (insert into challenge_sessions(id,version_id,perspective)
        select f.session,f.version,'judge' from fixture f join inserted_versions v on v.id=f.version returning id),
      inserted_snapshots as (insert into snapshots(id,workspace_id,data)
        select f.snapshot,${workspaces[0]}::uuid,jsonb_build_object('versionId',f.version)
        from fixture f join inserted_versions v on v.id=f.version returning id)
      insert into shares(token_hash,snapshot_id) select f.hash,f.snapshot
        from fixture f join inserted_snapshots s on s.id=f.snapshot`);
    const newOldSnapshotHash = randomBytes(32).toString("hex");
    await query(sql`insert into shares(token_hash,snapshot_id) values (${newOldSnapshotHash},${snapshotId}::uuid)`);
    const cappedResponse = await owner.get("/api/workspace/state");
    expect(cappedResponse.status()).toBe(200);
    const capped = await cappedResponse.json();
    for (const key of ["ideas", "challenges", "snapshots", "shares"]) expect(capped[key]).toHaveLength(50);
    expect(capped.ideas.every((item: { ideaId: string }) => bulk.some((fixture) => fixture.idea === item.ideaId))).toBe(true);
    expect(capped.challenges.every((item: { sessionId: string }) => bulk.some((fixture) => fixture.session === item.sessionId))).toBe(true);
    expect(capped.snapshots.some((item: { id: string }) => item.id === snapshotId)).toBe(false);
    expect(capped.shares[0]).toMatchObject({ id: newOldSnapshotHash.slice(0, 16), snapshotId });
    // A deliberately seeded prefix collision must not revoke the second matching row.
    const collision = hashes[0].slice(0, 16) + randomBytes(24).toString("hex");
    await query(sql`insert into shares(token_hash,snapshot_id) values (${collision},${snapshotId}::uuid)`);
    expect((await owner.post(revokePath, { headers })).status()).toBe(409);
    const collisionRows = await query(sql`select revoked_at from shares where token_hash=${collision}`);
    expect(collisionRows[0].revoked_at).toBeNull();
    await writeFile(info.outputPath("workspace-state.json"), JSON.stringify({ mode: "real-TEST-Neon-fictional-stored-fixtures",
      state: restored, foreignWorkspaceIsolated: true, repeatedRevokeStable: true, publicApiStatus: 410,
      publicPageState: "revoked", tokensAndFullHashesAbsent: true, allListCaps: 50,
      olderSnapshotShareListed: true, ambiguousRevokeStatus: 409 }, null, 2));
  } finally {
    await publicBrowser.close();
    await Promise.allSettled(clients.map((client) => client.dispose()));
    const cleanup = await Promise.allSettled(workspaces.map((id) => sql`delete from workspaces where id = ${id}::uuid`));
    if (cleanup.some((result) => result.status === "rejected")) throw new Error("Could not clean up an owned restore test workspace");
  }
});
