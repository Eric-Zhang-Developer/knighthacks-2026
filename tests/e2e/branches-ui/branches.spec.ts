import { expect, test, type Page } from "@playwright/test";
import suggested from "./fixtures/branch-suggest.json";

// Gemini is stubbed on the server through AI_STUB_DIR (this folder's fixtures); embeddings and Neon are real.
test.use({ trace: "off" }); // traces would hold the session cookie
const panel = (page: Page) => page.getByRole("region", { name: "Branches" });
type V = { ideaId: string; versionId: string; parentId: string | null; workflow: string | null; constraints: string | null };

test("suggest 3 directions, accept 2 as sibling stars, select each, and keep them after reload", async ({ page }) => {
  test.setTimeout(180_000);
  expect(process.env.AI_STUB_DIR, "Start the server with AI_STUB_DIR=tests/e2e/branches-ui/fixtures").toBeTruthy();
  await page.goto("/");
  await expect(page.locator("[data-workspace-id]")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals.");
  await page.getByRole("button", { name: "Interpret" }).click();
  await page.getByRole("region", { name: "Your idea" }).getByRole("button", { name: "Save" }).click();
  await expect(panel(page)).toHaveAttribute("data-branch-count", "0", { timeout: 60_000 });
  const [root] = (await (await page.request.get("/api/ideas")).json()) as V[];

  await panel(page).getByRole("button", { name: "Suggest directions" }).click();
  const directions = panel(page).getByRole("list", { name: "Directions" }).getByRole("listitem");
  await expect(directions).toHaveCount(3);
  for (const d of suggested.directions.slice(0, 2)) {
    await directions.filter({ hasText: d.title }).getByRole("button", { name: "Branch this way" }).click();
    await expect(directions.filter({ hasText: d.title })).toHaveCount(0, { timeout: 60_000 });
  }
  await expect(panel(page)).toHaveAttribute("data-branch-count", "2");
  await expect(panel(page)).toHaveAttribute("data-branch-stars", "2");

  // Both are siblings of version 1 in the database.
  const trail = (await (await page.request.get(`/api/revisions/trail/${root.ideaId}`)).json()) as V[];
  const branches = trail.filter((v) => v.parentId === root.versionId);
  expect(branches).toHaveLength(2);
  await page.screenshot({ path: test.info().outputPath("branches.png") });

  // Selecting each branch in the trail shows its own details.
  const tree = panel(page).getByLabel("Branch trail");
  for (const [i, b] of branches.entries()) {
    await tree.getByRole("button").nth(1 + i).click();
    const details = panel(page).getByLabel("Selected branch");
    await expect(details).toHaveAttribute("data-version-id", b.versionId);
    const changed = suggested.directions.find((d) => d.change === b.workflow || d.change === b.constraints)!;
    await expect(details).toContainText(changed.change);
  }

  // Reload: branch stars come back from the trail.
  await page.reload();
  await expect(panel(page)).toHaveAttribute("data-branch-stars", "2", { timeout: 60_000 });
});
