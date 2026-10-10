import { expect, test as base, type APIRequestContext, type APIResponse } from "@playwright/test";
import { writeFile } from "node:fs/promises";
// Each test tracks only successful workspace creation responses. Teardown runs
// even when assertions or request-context disposal fail.
const test = base.extend<{ createdWorkspaceIds: Set<string> }>({
  createdWorkspaceIds: async ({}, provide) => {
    const ids = new Set<string>();
    try { await provide(ids); }
    finally {
      if (ids.size) {
        if (!process.env.DATABASE_URL) throw new Error("Test workspace cleanup requires the same test DATABASE_URL as the app");
        const { neon } = await import("@neondatabase/serverless");
        const sql = neon(process.env.DATABASE_URL);
        // members and invites reference workspaces with ON DELETE CASCADE.
        // Never truncate or infer ownership from timestamps, prefixes or cookies.
        const results = await Promise.allSettled([...ids].map((id) => sql`delete from workspaces where id = ${id}::uuid`));
        if (results.some((result) => result.status === "rejected")) {
          throw new Error("Test workspace cleanup failed; inspect only this test's created workspace IDs on the test branch");
        }
      }
    }
  },
});
// Browser traces include bearer cookies and invite bodies; attach redacted evidence only.
test.use({ trace: "off" });
type Identity = { workspaceId: string; memberId: string };
async function identityFrom(response: APIResponse): Promise<Identity> {
  const body = await response.json();
  expect(Object.keys(body).sort()).toEqual(["memberId", "workspaceId"]);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  expect(typeof body.workspaceId === "string" && uuid.test(body.workspaceId), "Workspace identity must be a UUID").toBe(true);
  expect(typeof body.memberId === "string" && uuid.test(body.memberId), "Member identity must be a UUID").toBe(true);
  return { workspaceId: body.workspaceId, memberId: body.memberId };
}
function cookieAttributes(response: APIResponse) {
  const cookies = response.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie" && h.value.startsWith("__Host-uncharted-session="));
  expect(cookies.length).toBe(1);
  const parts = cookies[0].value.split(";").map((part) => part.trim());
  const attributes = new Map(parts.slice(1).map((part) => { const i = part.indexOf("="); return i < 0 ? [part.toLowerCase(), ""] : [part.slice(0, i).toLowerCase(), part.slice(i + 1)]; }));
  const safe = { name: "__Host-uncharted-session", hasValue: parts[0].length > "__Host-uncharted-session=".length, httpOnly: attributes.has("httponly"), secure: attributes.has("secure"), sameSite: attributes.get("samesite")?.toLowerCase(), path: attributes.get("path"), hostOnly: !attributes.has("domain") };
  expect(safe).toEqual({ name: "__Host-uncharted-session", hasValue: true, httpOnly: true, secure: true, sameSite: "lax", path: "/", hostOnly: true });
  return safe;
}
async function evidence(name: string, observed: unknown) {
  const body = JSON.stringify(observed, null, 2);
  await writeFile(test.info().outputPath(`${name}.json`), body);
  await test.info().attach(name, { body, contentType: "application/json" });
}
async function membership(workspaceId: string) {
  if (!process.env.DATABASE_URL) throw new Error("A dedicated test Neon DATABASE_URL is required for member-count validation");
  try {
    const { neon } = await import("@neondatabase/serverless");
    const rows = await neon(process.env.DATABASE_URL)`select w.member_count as declared_count, count(m.id)::int as count, array_agg(m.seat order by m.seat) as seats from workspaces w left join members m on m.workspace_id = w.id where w.id = ${workspaceId}::uuid group by w.id, w.member_count`;
    return { count: Number(rows[0].count), declaredCount: Number(rows[0].declared_count), seats: rows[0].seats };
  } catch { throw new Error("Test database member-count query failed"); }
}
async function create(client: APIRequestContext, headers: { origin: string }, createdWorkspaceIds: Set<string>) {
  const response = await client.post("/api/workspace", { headers });
  expect(response.status(), "A real test Neon DATABASE_URL and pushed schema are required; no mock or skipped DB verification").toBe(201);
  const identity = await identityFrom(response);
  createdWorkspaceIds.add(identity.workspaceId);
  return { identity, status: response.status(), cookie: cookieAttributes(response) };
}

test("two isolated sessions join once, retain identity, and reject reuse", async ({ playwright, baseURL, createdWorkspaceIds }) => {
  if (!baseURL) throw new Error("Playwright baseURL is required");
  const origin = new URL(baseURL).origin;
  const headers = { origin };
  const a = await playwright.request.newContext({ baseURL: origin });
  const b = await playwright.request.newContext({ baseURL: origin });
  try {
    const missing = await b.get("/api/workspace");
    expect(missing.status()).toBe(401);
    const created = await create(a, headers, createdWorkspaceIds);
    const owner = created.identity;
    const reused = await a.post("/api/workspace", { headers });
    expect(reused.status()).toBe(200);
    const reusedIdentity = await identityFrom(reused);
    expect(reusedIdentity).toEqual(owner);
    const invite = await a.post("/api/workspace/invite", { headers, data: {} });
    expect(invite.status()).toBe(201);
    const { inviteUrl } = await invite.json();
    const token = new URL(inviteUrl).pathname.split("/").pop();
    const joined = await b.post("/api/workspace/invite/redeem", { headers, data: { token } });
    expect(joined.status()).toBe(201);
    const teammate = await identityFrom(joined);
    const teammateCookie = cookieAttributes(joined);
    expect(teammate.workspaceId).toBe(owner.workspaceId);
    expect(teammate.memberId).not.toBe(owner.memberId);
    const ownerRead = await a.get("/api/workspace");
    const teammateRead = await b.get("/api/workspace");
    expect(ownerRead.status()).toBe(200); expect(teammateRead.status()).toBe(200);
    const ownerPersisted = await identityFrom(ownerRead), teammatePersisted = await identityFrom(teammateRead);
    expect(ownerPersisted).toEqual(owner); expect(teammatePersisted).toEqual(teammate);
    const replayClient = await playwright.request.newContext({ baseURL: origin });
    let replayStatus: number;
    try {
      const replay = await replayClient.post("/api/workspace/invite/redeem", { headers, data: { token } });
      replayStatus = replay.status(); expect(replayStatus).toBe(410);
      expect((await replayClient.get("/api/workspace")).status()).toBe(401);
    } finally { await replayClient.dispose(); }
    let forbiddenStatus: number;
    const stranger = await playwright.request.newContext({ baseURL: origin });
    try {
      await create(stranger, headers, createdWorkspaceIds);
      const forbidden = await stranger.post("/api/workspace/invite", { headers, data: { workspaceId: owner.workspaceId } });
      forbiddenStatus = forbidden.status(); expect(forbiddenStatus).toBe(403);
    } finally { await stranger.dispose(); }
    await evidence("workspace-responses", { created, joined: { status: joined.status(), identity: teammate, cookie: teammateCookie }, missingStatus: missing.status(), reused: { status: reused.status(), identity: reusedIdentity }, ownerRead: { status: ownerRead.status(), identity: ownerPersisted }, teammateRead: { status: teammateRead.status(), identity: teammatePersisted }, replayStatus, forbiddenStatus });
  } finally { await a.dispose(); await b.dispose(); }
});
for (const sameToken of [true, false]) {
  test(`concurrent ${sameToken ? "same" : "different"} invites claim only the second seat`, async ({ playwright, baseURL, createdWorkspaceIds }) => {
  if (!baseURL) throw new Error("Playwright baseURL is required");
  const origin = new URL(baseURL).origin;
  const headers = { origin };
    const clients = await Promise.all([0, 1, 2].map(() => playwright.request.newContext({ baseURL: origin })));
    const [a, b, c] = clients;
    try {
      const created = await create(a, headers, createdWorkspaceIds);
      const firstInvite = await a.post("/api/workspace/invite", { headers, data: {} });
      expect(firstInvite.status()).toBe(201);
      const invite1 = await firstInvite.json();
      let invite2 = invite1;
      if (!sameToken) {
        const secondInvite = await a.post("/api/workspace/invite", { headers, data: {} });
        expect(secondInvite.status()).toBe(201); invite2 = await secondInvite.json();
      }
      const tokens = [invite1, invite2].map((i) => new URL(i.inviteUrl).pathname.split("/").pop());
      const responses = await Promise.all([b, c].map((client, i) => client.post("/api/workspace/invite/redeem", { headers, data: { token: tokens[i] } })));
      expect(responses.map((r) => r.status()).sort()).toEqual([201, 410]);
      const full = await a.post("/api/workspace/invite", { headers, data: {} });
      expect(full.status()).toBe(409);
      const stored = await membership(created.identity.workspaceId);
      expect(stored).toEqual({ count: 2, declaredCount: 2, seats: [1, 2] });
      const winnerIndex = responses.findIndex((r) => r.status() === 201);
      const loserIndex = 1 - winnerIndex;
      const winner = await identityFrom(responses[winnerIndex]);
      expect(winner.workspaceId).toBe(created.identity.workspaceId);
      expect(winner.memberId).not.toBe(created.identity.memberId);
      const winnerRead = await [b, c][winnerIndex].get("/api/workspace");
      expect(winnerRead.status()).toBe(200); expect(await identityFrom(winnerRead)).toEqual(winner);
      const loserRead = await [b, c][loserIndex].get("/api/workspace");
      expect(loserRead.status()).toBe(401);
      const loserSetsCookie = responses[loserIndex].headersArray().some((h) => h.name.toLowerCase() === "set-cookie");
      expect(loserSetsCookie).toBe(false);
      await evidence("race-statuses", { sameToken, workspaceId: created.identity.workspaceId, statuses: responses.map((r) => r.status()), fullStatus: full.status(), stored, winner, winnerReadStatus: winnerRead.status(), loserReadStatus: loserRead.status(), loserSetsCookie });
    } finally { await Promise.all(clients.map((c) => c.dispose())); }
  });
}

test("expired invites return 410 without creating a session", async ({ playwright, baseURL, createdWorkspaceIds }) => {
  if (!baseURL) throw new Error("Playwright baseURL is required");
  const origin = new URL(baseURL).origin;
  const headers = { origin };
  const { neon } = await import("@neondatabase/serverless");
  const { createHash } = await import("node:crypto");
  expect(Boolean(process.env.DATABASE_URL), "A disposable test Neon branch is required").toBe(true);
  const a = await playwright.request.newContext({ baseURL: origin });
  const b = await playwright.request.newContext({ baseURL: origin });
  try {
    await create(a, headers, createdWorkspaceIds);
    const issuance = await a.post("/api/workspace/invite", { headers, data: {} });
    expect(issuance.status()).toBe(201);
    const issued = await issuance.json();
    const token = new URL(issued.inviteUrl).pathname.split("/").pop()!;
    const hash = createHash("sha256").update(token).digest("hex");
    try { await neon(process.env.DATABASE_URL!)`update invites set expires_at = now() - interval '1 second' where token_hash = ${hash}`; }
    catch { throw new Error("Test invite expiry setup failed"); }
    const expired = await b.post("/api/workspace/invite/redeem", { headers, data: { token } });
    expect(expired.status()).toBe(410);
    const setsCookie = expired.headersArray().some((h) => h.name.toLowerCase() === "set-cookie");
    expect(setsCookie).toBe(false);
    const anonymous = await b.get("/api/workspace"); expect(anonymous.status()).toBe(401);
    await evidence("expiry-responses", { expiredStatus: expired.status(), setsCookie, anonymousStatus: anonymous.status() });
  } finally { await a.dispose(); await b.dispose(); }
});
