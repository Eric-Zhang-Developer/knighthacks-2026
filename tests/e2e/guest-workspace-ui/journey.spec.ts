import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// Real backend, real test Neon branch, nothing intercepted. The server reads DATABASE_URL, so it must be the test
// branch: this suite creates workspaces and expires an invite directly in that database.
const COOKIE = "__Host-uncharted-session";
test.beforeAll(() => {
  expect(process.env.TEST_DATABASE_URL, "set TEST_DATABASE_URL (.env.example)").toBeTruthy();
  expect(process.env.DATABASE_URL, "run with DATABASE_URL=$TEST_DATABASE_URL so the app writes to the test branch").toBe(
    process.env.TEST_DATABASE_URL,
  );
});

const evidence = (name: string, data: unknown) =>
  writeFileSync(test.info().outputPath(name), JSON.stringify(data, null, 2));

// Workspace traffic for one context: what the browser sent and which responses tried to set the session cookie.
function watch(page: Page) {
  const posts: string[] = [];
  const setCookies: string[] = [];
  page.on("request", (r) => r.method() === "POST" && new URL(r.url()).pathname.startsWith("/api/workspace") && posts.push(new URL(r.url()).pathname));
  page.on("response", async (r) => {
    const header = (await r.headerValue("set-cookie")) ?? "";
    if (header.includes(COOKIE)) setCookies.push(new URL(r.url()).pathname);
  });
  return { posts, setCookies };
}

const sessionCookie = async (ctx: BrowserContext) => (await ctx.cookies()).find((c) => c.name === COOKIE);
const workspaceId = (page: Page, panel: "Workspace" | "Invite") =>
  page.getByRole("region", { name: panel }).locator("[data-workspace-id]").getAttribute("data-workspace-id");

async function openHome(ctx: BrowserContext) {
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Workspace" }).locator("[data-workspace-id]")).toBeVisible();
  return page;
}

async function createInvite(page: Page) {
  await page.getByRole("button", { name: "Invite a teammate" }).click();
  const link = page.getByRole("textbox", { name: "Invite link" });
  await expect(link).toHaveValue(/\/invite\/[A-Za-z0-9_-]{43}$/);
  return link.inputValue();
}

async function join(page: Page) {
  const redeemed = page.waitForResponse((r) => r.url().endsWith("/api/workspace/invite/redeem"));
  await page.getByRole("button", { name: "Join" }).click();
  return redeemed;
}

test("A's first visit makes a workspace; B joins it only by choosing Join", async ({ browser }) => {
  const a = await browser.newContext();
  const pageA = await openHome(a);
  const cookieA = await sessionCookie(a);
  expect(cookieA).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax", path: "/" });
  const idA = await workspaceId(pageA, "Workspace");
  const inviteUrl = await createInvite(pageA);

  const b = await browser.newContext();
  const pageB = await b.newPage();
  const trafficB = watch(pageB);
  await pageB.goto(new URL(inviteUrl).pathname);
  await expect(pageB.getByRole("button", { name: "Join" })).toBeVisible();
  await pageB.waitForLoadState("networkidle");
  const beforeJoin = { posts: [...trafficB.posts], cookieSet: [...trafficB.setCookies], cookie: (await sessionCookie(b)) ?? null };
  expect(beforeJoin, "opening the invite must not create or redeem").toEqual({ posts: [], cookieSet: [], cookie: null });

  const redeemed = await join(pageB);
  expect(redeemed.status()).toBe(201);
  await expect(pageB.getByRole("region", { name: "Invite" })).toContainText("You joined workspace");
  expect(await workspaceId(pageB, "Invite")).toBe(idA);
  expect(trafficB.posts).toEqual(["/api/workspace/invite/redeem"]);

  // B's session now opens the same workspace at home: reused (200), not a new one.
  const reused = pageB.waitForResponse((r) => r.url().endsWith("/api/workspace") && r.request().method() === "POST");
  await pageB.getByRole("link", { name: "Open the galaxy" }).click();
  expect((await reused).status()).toBe(200);
  await expect(pageB.getByRole("region", { name: "Workspace" }).locator("[data-workspace-id]")).toHaveAttribute("data-workspace-id", idA!);
  // Each browser's own session, read back from the API: same workspace, different members.
  const meA = await (await pageA.request.get("/api/workspace")).json();
  const meB = await (await pageB.request.get("/api/workspace")).json();
  expect(meB.workspaceId).toBe(meA.workspaceId);
  expect(meB.memberId).not.toBe(meA.memberId);

  // The same link again, from a third browser: 410 and a visible "unavailable", never a join.
  const c = await browser.newContext();
  const pageC = await c.newPage();
  await pageC.goto(new URL(inviteUrl).pathname);
  const reusedLink = await join(pageC);
  expect(reusedLink.status()).toBe(410);
  await expect(pageC.getByRole("region", { name: "Invite" }).getByRole("alert")).toContainText("invite is unavailable");
  await expect(pageC.getByText("You joined workspace")).toHaveCount(0);

  await pageA.screenshot({ path: test.info().outputPath("workspace-a.png") }); // the link is spent by now
  await pageC.screenshot({ path: test.info().outputPath("invite-reused.png") });
  evidence("journey.json", {
    cookieA: { name: cookieA!.name, httpOnly: cookieA!.httpOnly, secure: cookieA!.secure, sameSite: cookieA!.sameSite, path: cookieA!.path },
    identityA: meA,
    identityB: meB,
    beforeJoin,
    redeem: redeemed.status(),
    reuse: reusedLink.status(),
  });
  await Promise.all([a.close(), b.close(), c.close()]);
});

test("an expired invite shows unavailable on Join", async ({ browser }) => {
  const a = await browser.newContext();
  const inviteUrl = await createInvite(await openHome(a));
  const token = new URL(inviteUrl).pathname.split("/").pop()!;
  const sql = neon(process.env.TEST_DATABASE_URL!);
  const expired = await sql.query("update invites set expires_at = now() - interval '1 minute' where token_hash = $1 returning 1", [
    createHash("sha256").update(token).digest("hex"),
  ]);
  expect(expired, "the invite the UI created is in the test branch").toHaveLength(1);

  const b = await browser.newContext();
  const pageB = await b.newPage();
  await pageB.goto(new URL(inviteUrl).pathname);
  const res = await join(pageB);
  expect(res.status()).toBe(410);
  await expect(pageB.getByRole("region", { name: "Invite" }).getByRole("alert")).toContainText("invite is unavailable");
  expect(await sessionCookie(b)).toBeUndefined();
  evidence("expired.json", { redeem: res.status(), body: await res.json() });
  await Promise.all([a.close(), b.close()]);
});

test("no recovery: clearing cookies loses the workspace and the UI says so", async ({ browser }) => {
  const a = await browser.newContext();
  const page = await openHome(a);
  await expect(page.getByRole("region", { name: "Workspace" })).toContainText("Clear cookies and it's gone for good.");
  const before = await workspaceId(page, "Workspace");

  await a.clearCookies();
  const read = await page.request.get("/api/workspace");
  expect(read.status()).toBe(401);
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Workspace" }).locator("[data-workspace-id]")).not.toHaveAttribute("data-workspace-id", before!);
  const after = await workspaceId(page, "Workspace");
  expect(after).not.toBe(before);
  evidence("no-recovery.json", { before, readAfterClear: read.status(), after });
  await a.close();
});

test("share pages never create or redeem a session", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const traffic = watch(page);
  await page.goto("/s/layout-exclusion-check");
  await page.waitForLoadState("networkidle");
  expect(traffic.posts).toEqual([]);
  expect(traffic.setCookies).toEqual([]);
  expect(await sessionCookie(ctx)).toBeUndefined();
  evidence("share-exclusion.json", traffic);
  await ctx.close();
});
