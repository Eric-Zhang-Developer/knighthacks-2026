import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

// Two browsers in one workspace (owner + invited teammate) on the Neon test branch; the two ideas they vote on are
// saved through the real API (real embeddings). No generation runs. Traces would hold session cookies.
test.use({ trace: "off" });
const idea = (title: string) => ({ title, description: `${title} for hackathon teams`, audience: "Hackathon teammates",
  problem: null, workflow: null, constraints: null });
const panel = (page: Page) => page.getByRole("region", { name: "Team vote" });
const result = (page: Page) => panel(page).getByRole("status", { name: "Vote result" });

test("browser A votes and waits; browser B votes; both see both and the disagreement", async ({ browser, baseURL }, info) => {
  test.setTimeout(150_000);
  expect(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL, "App and verifier must both use the test branch").toBe(true);
  const origin = new URL(baseURL!).origin, headers = { origin };
  const [ctxA, ctxB] = await Promise.all([browser.newContext({ baseURL: origin }), browser.newContext({ baseURL: origin })]);
  const [a, b] = await Promise.all([ctxA.newPage(), ctxB.newPage()]);
  // The evidence panel would call the live model for each saved idea; it is not under test here.
  for (const ctx of [ctxA, ctxB]) await ctx.route("**/api/evidence/**", (route) => route.abort());

  // Setup through the API: A's workspace, B joins by invite, two ideas to choose between.
  expect((await ctxA.request.post("/api/workspace", { headers })).status()).toBe(201);
  const { inviteUrl } = await (await ctxA.request.post("/api/workspace/invite", { headers, data: {} })).json();
  expect((await ctxB.request.post("/api/workspace/invite/redeem", { headers, data: { token: new URL(inviteUrl).pathname.split("/").pop() } })).status()).toBe(201);
  for (const title of ["Shared meal planner", "Snack drop scheduler"]) {
    expect((await ctxA.request.post("/api/ideas", { headers: { ...headers, "Idempotency-Key": randomUUID() }, data: idea(title) })).status()).toBe(201);
  }

  await Promise.all([a.goto("/"), b.goto("/")]);
  for (const page of [a, b]) await expect(panel(page)).toBeVisible({ timeout: 30_000 });

  // A votes and waits; nothing of A's vote reaches B's panel.
  const concernA = "Allergies might rule out a shared order";
  await panel(a).getByRole("combobox", { name: "Preferred version" }).selectOption({ label: "Shared meal planner" });
  await panel(a).getByRole("textbox", { name: "One concern" }).fill(concernA);
  await panel(a).getByRole("button", { name: "Vote" }).click();
  await expect(result(a)).toContainText("Waiting for your teammate");
  await expect(result(a)).toContainText("Shared meal planner");
  await b.waitForTimeout(5000); // longer than one poll
  await expect(panel(b)).not.toContainText(concernA);
  await expect(result(b)).toHaveCount(0);
  await expect(panel(b).getByRole("button", { name: "Vote" })).toBeVisible();

  // B votes for the other idea: both browsers show both votes and that they differ.
  await panel(b).getByRole("combobox", { name: "Preferred version" }).selectOption({ label: "Snack drop scheduler" });
  await panel(b).getByRole("button", { name: "Vote" }).click();
  for (const page of [b, a]) {
    await expect(result(page)).toContainText("You picked different versions.", { timeout: 15_000 });
    await expect(result(page)).toContainText(concernA);
    await expect(result(page).locator('[data-vote="Teammate"]')).toContainText(page === a ? "Snack drop scheduler" : "Shared meal planner");
  }
  for (const [page, name] of [[a, "browser-a.png"], [b, "browser-b.png"]] as const) {
    await result(page).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(name) });
  }

  // A changes to agree: both see agreement, and A's vote marked as changed after the reveal.
  await panel(a).getByRole("combobox", { name: "Preferred version" }).selectOption({ label: "Snack drop scheduler" });
  await panel(a).getByRole("button", { name: "Change vote" }).click();
  await expect(result(a)).toContainText("You agree.");
  await expect(result(b)).toContainText("You agree.", { timeout: 15_000 });
  await expect(result(b).locator('[data-vote="Teammate"]')).toContainText("changed after reveal");
  await Promise.all([ctxA.close(), ctxB.close()]);
});
