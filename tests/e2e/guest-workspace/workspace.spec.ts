import { expect, test as base, type APIRequestContext } from "@playwright/test";
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
async function create(client: APIRequestContext, headers: { origin: string }, createdWorkspaceIds: Set<string>) {
  const response = await client.post("/api/workspace", { headers });
  expect(response.status(), "A real test Neon DATABASE_URL and pushed schema are required; no mock or skipped DB verification").toBe(201);
  const identity = await response.json() as { workspaceId: string; memberId: string };
  expect(identity.workspaceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  createdWorkspaceIds.add(identity.workspaceId);
  return identity;
}
test("two isolated sessions join once, retain identity, and reject reuse", async ({ playwright, baseURL, createdWorkspaceIds }) => {
  if (!baseURL) throw new Error("Playwright baseURL is required");
  const origin = new URL(baseURL).origin;
  const headers = { origin };
  const a = await playwright.request.newContext({ baseURL: origin });
  const b = await playwright.request.newContext({ baseURL: origin });
  try {
    const owner = await create(a, headers, createdWorkspaceIds);
    const invite = await a.post("/api/workspace/invite", { headers, data: {} });
    expect(invite.status()).toBe(201);
    const { inviteUrl } = await invite.json();
    const token = new URL(inviteUrl).pathname.split("/").pop();
    const joined = await b.post("/api/workspace/invite/redeem", { headers, data: { token } });
    expect(joined.status()).toBe(201);
    const teammate = await joined.json();
    expect(teammate.workspaceId).toBe(owner.workspaceId);
    expect(teammate.memberId).not.toBe(owner.memberId);
    expect(await (await b.get("/api/workspace")).json()).toEqual(teammate);
    expect((await a.post("/api/workspace/invite/redeem", { headers, data: { token } })).status()).toBe(410);
    const stranger = await playwright.request.newContext({ baseURL: origin });
    try {
      await create(stranger, headers, createdWorkspaceIds);
      expect((await stranger.post("/api/workspace/invite", { headers, data: { workspaceId: owner.workspaceId } })).status()).toBe(403);
    } finally { await stranger.dispose(); }
    await test.info().attach("workspace-responses", { body: JSON.stringify({ owner, teammate, reusedStatus: 410 }), contentType: "application/json" });
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
      await create(a, headers, createdWorkspaceIds);
      const invite1 = await (await a.post("/api/workspace/invite", { headers, data: {} })).json();
      const invite2 = sameToken ? invite1 : await (await a.post("/api/workspace/invite", { headers, data: {} })).json();
      const tokens = [invite1, invite2].map((i) => new URL(i.inviteUrl).pathname.split("/").pop());
      const responses = await Promise.all([b, c].map((client, i) => client.post("/api/workspace/invite/redeem", { headers, data: { token: tokens[i] } })));
      expect(responses.map((r) => r.status()).sort()).toEqual([201, 410]);
      expect((await a.post("/api/workspace/invite", { headers, data: {} })).status()).toBe(409);
      await test.info().attach("race-statuses", { body: JSON.stringify(responses.map((r) => r.status())), contentType: "application/json" });
    } finally { await Promise.all(clients.map((c) => c.dispose())); }
  });
}

test("expired invites return 410 without creating a session", async ({ playwright, baseURL, createdWorkspaceIds }) => {
  if (!baseURL) throw new Error("Playwright baseURL is required");
  const origin = new URL(baseURL).origin;
  const headers = { origin };
  const { neon } = await import("@neondatabase/serverless");
  const { createHash } = await import("node:crypto");
  expect(process.env.DATABASE_URL, "A disposable test Neon branch is required").toBeTruthy();
  const a = await playwright.request.newContext({ baseURL: origin });
  const b = await playwright.request.newContext({ baseURL: origin });
  try {
    await create(a, headers, createdWorkspaceIds);
    const issued = await (await a.post("/api/workspace/invite", { headers, data: {} })).json();
    const token = new URL(issued.inviteUrl).pathname.split("/").pop()!;
    const hash = createHash("sha256").update(token).digest("hex");
    await neon(process.env.DATABASE_URL!)`update invites set expires_at = now() - interval '1 second' where token_hash = ${hash}`;
    const expired = await b.post("/api/workspace/invite/redeem", { headers, data: { token } });
    expect(expired.status()).toBe(410);
    expect(expired.headers()["set-cookie"]).toBeUndefined();
    expect((await b.get("/api/workspace")).status()).toBe(401);
  } finally { await a.dispose(); await b.dispose(); }
});
