import { createHash, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";

test.use({ trace: "off" }); // Workspace cookies and capability tokens stay out of reports.

test("read a frozen snapshot anonymously without access to its workspace, then revoke the capability", async ({ playwright, baseURL }, info) => {
  test.setTimeout(150_000);
  expect(Boolean(process.env.TEST_DATABASE_URL)).toBe(true);
  expect(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL, "App and verifier must use the dedicated test branch").toBe(true);
  if (!baseURL) throw new Error("Verifier URL required");
  const sql = neon(process.env.TEST_DATABASE_URL!);
  async function query<T>(operation: PromiseLike<T>): Promise<T> {
    try { return await operation; }
    catch { throw new Error("Share verification query failed on the test database"); }
  }
  const origin = new URL(baseURL).origin, headers = { origin };
  const clients = await Promise.all([0, 1, 2].map(() => playwright.request.newContext({ baseURL: origin })));
  const [owner, stranger, reader] = clients;
  const workspaces = new Set<string>();
  let retainedWorkspace: string | undefined;
  try {
    let workspaceId = "";
    for (const client of [owner, stranger]) {
      const response = await client.post("/api/workspace", { headers });
      expect(response.status()).toBe(201);
      const data = await response.json(); workspaces.add(data.workspaceId);
      if (client === owner) workspaceId = data.workspaceId;
    }
    const idea = await owner.post("/api/ideas", { headers: { ...headers, "Idempotency-Key": randomUUID() }, data: {
      title: "Hackathon meal coordination", description: "Help teammates choose shared meals that meet dietary requirements.",
      audience: "Hackathon teammates", problem: "Meal coordination interrupts building", workflow: "Collect requirements and choose a shared meal", constraints: null,
    } });
    expect(idea.status(), "Requires real HF embeddings").toBe(201);
    const version = await idea.json();
    const frozenResponse = await owner.post("/api/snapshots", { headers, data: { versionId: version.versionId } });
    expect(frozenResponse.status()).toBe(201);
    const frozen = await frozenResponse.json(), request = { snapshotId: frozen.snapshotId };
    expect((await reader.post("/api/shares", { headers, data: request })).status()).toBe(401);
    expect((await stranger.post("/api/shares", { headers, data: request })).status()).toBe(404);
    expect((await owner.post("/api/shares", { headers: { origin: "https://foreign.invalid" }, data: request })).status()).toBe(403);
    async function createShare() {
      const response = await owner.post("/api/shares", { headers, data: request });
      expect(response.status()).toBe(201);
      const data = await response.json() as { token: string; url: string };
      expect(Object.keys(data).sort()).toEqual(["token", "url"]);
      expect(/^[A-Za-z0-9_-]{22}$/.test(data.token)).toBe(true);
      expect(Buffer.from(data.token, "base64url").length).toBe(16);
      expect(data.url === `${origin}/s/${data.token}`).toBe(true);
      return data;
    }
    const share = await createShare(), second = await createShare();
    expect(share.token === second.token).toBe(false);
    const path = `/api/shares/${share.token}`, secondPath = `/api/shares/${second.token}`;
    const stored = await query(sql`select token_hash, revoked_at from shares where snapshot_id = ${frozen.snapshotId}::uuid`);
    expect(stored).toHaveLength(2);
    const hashes = [share.token, second.token].map((token) => createHash("sha256").update(token).digest("hex")).sort();
    expect(stored.map((row) => row.token_hash).sort()).toEqual(hashes);
    expect(stored.every((row) => row.revoked_at === null)).toBe(true);
    expect((await reader.get("/api/ideas")).status()).toBe(401);
    const publicResponse = await reader.get(path);
    expect(publicResponse.status()).toBe(200);
    expect(Boolean(publicResponse.headers()["set-cookie"])).toBe(false);
    expect(publicResponse.headers()["cache-control"]).toContain("no-store");
    expect(await publicResponse.json()).toEqual(frozen.data);
    expect((await reader.storageState()).cookies.length).toBe(0);
    expect((await reader.get("/api/ideas")).status()).toBe(401);
    expect((await reader.get(`/api/snapshots/${frozen.snapshotId}`)).status()).toBe(401);
    expect((await reader.delete(path, { headers })).status()).toBe(401);
    expect((await stranger.delete(path, { headers })).status()).toBe(404);
    expect((await owner.delete(path, { headers: { origin: "https://foreign.invalid" } })).status()).toBe(403);
    expect((await reader.get(path)).status()).toBe(200);
    expect((await owner.delete(path, { headers })).status()).toBe(204);
    expect((await owner.delete(path, { headers })).status()).toBe(204);
    const revoked = await reader.get(path);
    expect(revoked.status()).toBe(410); expect(await revoked.json()).toEqual({ error: "revoked" });
    expect(Boolean(revoked.headers()["set-cookie"])).toBe(false);
    expect(revoked.headers()["cache-control"]).toContain("no-store");
    expect((await reader.get(secondPath)).status(), "Revoking one link must not revoke another choice").toBe(200);
    expect((await owner.delete(secondPath, { headers })).status()).toBe(204);
    expect((await reader.get(secondPath)).status()).toBe(410);
    const gone = await reader.get("/api/shares/not-a-token"); expect(gone.status()).toBe(404);
    expect(Boolean(gone.headers()["set-cookie"])).toBe(false);
    const finalRows = await query(sql`select revoked_at from shares where snapshot_id = ${frozen.snapshotId}::uuid`);
    expect(finalRows.every((row) => row.revoked_at !== null)).toBe(true);
    const report = JSON.stringify({ mode: "real-neon-and-hugging-face-no-generation", retainedWorkspace: workspaceId,
      snapshotId: frozen.snapshotId, shareCount: stored.length, onlyHashesStored: true, anonymousReadStatus: 200,
      noWorkspaceAccess: true, noCookiesSet: true, foreignRevokeStatus: 404, ownerRevokeStatus: 204,
      subsequentReadStatus: 410, retainedSharesRevoked: true }, null, 2);
    await writeFile(info.outputPath("revoked-shares.json"), report);
    await info.attach("revoked-shares", { body: report, contentType: "application/json" });
    retainedWorkspace = workspaceId;
  } finally {
    const cleanup = await Promise.allSettled([...workspaces].filter((id) => id !== retainedWorkspace).map((id) => sql`delete from workspaces where id = ${id}::uuid`));
    await Promise.allSettled(clients.map((client) => client.dispose()));
    if (cleanup.some((result) => result.status === "rejected")) throw new Error("Share cleanup failed for its explicit test workspaces");
  }
});
