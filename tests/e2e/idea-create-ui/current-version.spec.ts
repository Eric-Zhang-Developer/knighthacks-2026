import { expect, test, type Route } from "@playwright/test";
import type { Version } from "@/components/idea/fields";

test.use({ trace: "off", reducedMotion: "reduce" });

test("saved card follows accepted revisions and older selections without replacing drafts or accepting late responses", async ({ page }) => {
  test.setTimeout(180_000);
  expect(process.env.AI_STUB_DIR, "Run with the idea and revision fixtures").toBeTruthy();
  const card = page.getByRole("region", { name: "Your idea" });
  const revisions = page.getByRole("region", { name: "Revisions" });
  const branches = page.getByRole("region", { name: "Branches" });
  await page.goto("/");
  await expect(page.locator("[data-workspace-id]")).toBeVisible({ timeout: 30_000 });
  await card.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals.");
  await card.getByRole("button", { name: "Interpret" }).click();
  const saved = page.waitForResponse((r) => r.url().endsWith("/api/ideas") && r.request().method() === "POST");
  await card.getByRole("button", { name: "Save", exact: true }).click();
  const original = (await (await saved).json()) as Version;
  await expect(revisions).toHaveAttribute("data-current-version", original.versionId, { timeout: 60_000 });
  await revisions.getByRole("button", { name: "Suggest revisions" }).click();
  const accepted = page.waitForResponse((r) => /\/api\/revisions\/[^/]+\/accept$/.test(r.url()));
  await revisions.getByRole("button", { name: "Accept", exact: true }).first().click();
  const revised = (await (await accepted).json()) as Version;
  expect(revised.versionId).not.toBe(original.versionId);
  await expect(revisions).toHaveAttribute("data-current-version", revised.versionId);
  // Ordinary revisions change fields absent from the summary text; identify the actual saved version and position.
  await expect(card, "The saved idea card must follow the accepted revision").toHaveAttribute("data-version-id", revised.versionId);
  await expect(card).toHaveAttribute("data-position", `${revised.x},${revised.y},${revised.z}`);
  await page.screenshot({ path: test.info().outputPath("accepted-card.png") });

  const versions = branches.getByLabel("Branch trail").getByRole("button");
  await expect(versions).toHaveCount(2);
  // GET /api/ideas returns the latest only. Older selections must use this idea's saved trail.
  await versions.first().click();
  await expect(card).toHaveAttribute("data-version-id", original.versionId);
  await expect(card).toHaveAttribute("data-position", `${original.x},${original.y},${original.z}`);
  await expect(versions.first()).toHaveAttribute("aria-pressed", "true");
  await versions.nth(1).click();
  await expect(card).toHaveAttribute("data-version-id", revised.versionId);

  const held: Route[] = [];
  const delayReads = async (route: Route) => { held.push(route); };
  async function releaseReads() {
    await page.unroute("**/api/ideas", delayReads);
    await Promise.all(held.splice(0).map(async (route) => {
      await route.fulfill({ json: [revised] });
      await (await route.request().response())?.finished();
    }));
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  }
  await page.route("**/api/ideas", delayReads);
  await versions.first().click();
  await expect.poll(() => held.length).toBeGreaterThan(0);
  await versions.nth(1).click();
  await releaseReads();
  // Drain the delayed responses, including the history lookup they could trigger.
  await expect(versions.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(card).toHaveAttribute("data-version-id", revised.versionId);
  await expect(card.getByRole("alert")).toHaveCount(0);

  await page.route("**/api/ideas", delayReads);
  await versions.first().click();
  await expect.poll(() => held.length).toBeGreaterThan(0);
  await card.getByRole("button", { name: "New idea" }).click();
  const draft = "Keep this unsaved second idea while the earlier version loads.";
  await card.getByRole("textbox", { name: "Describe your idea" }).fill(draft);
  await releaseReads();
  await expect(card.getByRole("textbox", { name: "Describe your idea" })).toHaveValue(draft);
  await card.getByRole("button", { name: "Interpret" }).click();
  await expect(card.getByRole("heading")).toHaveText("Check the interpretation");
  await versions.nth(1).click();
  await expect(card.getByRole("heading")).toHaveText("Check the interpretation");
  await expect(card.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
  await page.screenshot({ path: test.info().outputPath("selected-version-with-draft.png") });
});
