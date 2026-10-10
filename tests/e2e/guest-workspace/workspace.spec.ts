import { expect, test, type APIRequestContext } from "@playwright/test";
// Browser traces include bearer cookies and invite bodies; attach redacted evidence only.
test.use({ trace: "off" });
async function create(client: APIRequestContext, headers: { origin: string }) {
  const response = await client.post("/api/workspace", { headers });
  expect(response.status(), "A real test Neon DATABASE_URL and pushed schema are required; no mock or skipped DB verification").toBe(201);
  return response.json() as Promise<{ workspaceId: string; memberId: string }>;
}
test("two isolated sessions join once, retain identity, and reject reuse", async ({ playwright, baseURL }) => {
  if (!baseURL) throw new Error("Playwright baseURL is required");
  const origin = new URL(baseURL).origin;
  const headers = { origin };
  const a = await playwright.request.newContext({ baseURL: origin });
  const b = await playwright.request.newContext({ baseURL: origin });
  try {
    const owner = await create(a, headers);
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
      await create(stranger, headers);
      expect((await stranger.post("/api/workspace/invite", { headers, data: { workspaceId: owner.workspaceId } })).status()).toBe(403);
    } finally { await stranger.dispose(); }
    await test.info().attach("workspace-responses", { body: JSON.stringify({ owner, teammate, reusedStatus: 410 }), contentType: "application/json" });
  } finally { await a.dispose(); await b.dispose(); }
});
for (const sameToken of [true, false]) {
  test(`concurrent ${sameToken ? "same" : "different"} invites claim only the second seat`, async ({ playwright, baseURL }) => {
  if (!baseURL) throw new Error("Playwright baseURL is required");
  const origin = new URL(baseURL).origin;
  const headers = { origin };
    const clients = await Promise.all([0, 1, 2].map(() => playwright.request.newContext({ baseURL: origin })));
    const [a, b, c] = clients;
    try {
      await create(a, headers);
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

test("expired invites return 410 without creating a session", async ({ playwright, baseURL }) => {
  if (!baseURL) throw new Error("Playwright baseURL is required");
  const origin = new URL(baseURL).origin;
  const headers = { origin };
  const { neon } = await import("@neondatabase/serverless");
  const { createHash } = await import("node:crypto");
  expect(process.env.DATABASE_URL, "A disposable test Neon branch is required").toBeTruthy();
  const a = await playwright.request.newContext({ baseURL: origin });
  const b = await playwright.request.newContext({ baseURL: origin });
  try {
    await create(a, headers);
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
