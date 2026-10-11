import { expect, test } from "@playwright/test";

// #288: on a first visit, nothing may read the workspace before the guest workspace exists. The snapshot history
// fetched /api/workspace/state on mount and raced POST /api/workspace: a correct 401 the console then reported.
// Holding the workspace back 1.5 s makes the race certain instead of occasional.
test.use({ trace: "off" }); // traces would hold the session cookie
test("a slow first workspace start: no request is refused for want of a session", async ({ page }) => {
  test.setTimeout(120_000);
  await page.route("**/api/workspace", async (route) => {
    if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  const refused: string[] = [];
  page.on("response", (r) => r.status() === 401 && refused.push(`${r.request().method()} ${new URL(r.url()).pathname}`));
  await page.goto("/");
  await expect(page.locator("[data-workspace-id]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("canvas")).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(2000); // anything mounted late has had its chance to fetch
  expect(refused).toEqual([]);
});
