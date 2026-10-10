import { expect, test, type Page } from "@playwright/test";
import interpretation from "./fixtures/idea-interpret.json";
import proposal from "./fixtures/revision-propose.json";

// Gemini is stubbed on the server through AI_STUB_DIR (this folder's fixtures); saving and re-placing a version
// use the real embedding model and the Neon test branch.
test.use({ trace: "off" }); // traces would hold the session cookie

const panel = (page: Page) => page.getByRole("region", { name: "Revisions" });
const trailOf = async (page: Page, ideaId: string) =>
  (await (await page.request.get(`/api/revisions/trail/${ideaId}`)).json()) as { versionId: string; parentId: string | null }[];

test("reject changes nothing, accept makes version 2, and the trail previews version 1", async ({ page }) => {
  test.setTimeout(180_000);
  expect(process.env.AI_STUB_DIR, "Start the server with AI_STUB_DIR=tests/e2e/idea-revisions-ui/fixtures").toBeTruthy();
  await page.goto("/");
  await expect(page.locator("[data-workspace-id]")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals.");
  await page.getByRole("button", { name: "Interpret" }).click();
  await page.getByRole("region", { name: "Your idea" }).getByRole("button", { name: "Save" }).click();

  await expect(panel(page)).toHaveAttribute("data-trail-length", "1", { timeout: 60_000 });
  const v1 = (await panel(page).getAttribute("data-current-version"))!;
  const ideaId = ((await (await page.request.get("/api/ideas")).json()) as { ideaId: string; versionId: string }[]).find(
    (v) => v.versionId === v1,
  )!.ideaId;

  await panel(page).getByRole("button", { name: "Suggest revisions" }).click();
  const suggestions = panel(page).getByRole("list", { name: "Suggestions" }).getByRole("listitem");
  await expect(suggestions).toHaveCount(proposal.suggestions.length);

  // Reject: the suggestion goes, nothing else changes, and the database has no new version.
  await suggestions.first().getByRole("button", { name: "Reject" }).click();
  await expect(suggestions).toHaveCount(proposal.suggestions.length - 1);
  await expect(panel(page)).toHaveAttribute("data-current-version", v1);
  await expect(panel(page)).toHaveAttribute("data-trail-length", "1");
  expect(await trailOf(page, ideaId)).toHaveLength(1);

  // Accept: a new version whose parent is version 1 becomes current.
  await suggestions.first().getByRole("button", { name: "Accept" }).click();
  await expect(panel(page)).toHaveAttribute("data-trail-length", "2", { timeout: 60_000 });
  const v2 = (await panel(page).getAttribute("data-current-version"))!;
  expect(v2).not.toBe(v1);
  const trail = await trailOf(page, ideaId);
  expect(trail.map((v) => v.versionId)).toEqual([v1, v2]);
  expect(trail[1].parentId).toBe(v1);
  const accepted = proposal.suggestions[1];
  await expect(panel(page).getByLabel("Shown version")).toContainText(accepted.change);
  await page.screenshot({ path: test.info().outputPath("accepted.png") });

  // Preview version 1: it shows; the current version stays version 2.
  await panel(page).getByRole("button", { name: /^Version 1/ }).click();
  const shown = panel(page).getByLabel("Shown version");
  await expect(shown).toHaveAttribute("data-version-id", v1);
  await expect(shown).toContainText(interpretation.audience);
  await expect(shown).toContainText("The current version is still 2");
  await expect(panel(page)).toHaveAttribute("data-current-version", v2);
});
