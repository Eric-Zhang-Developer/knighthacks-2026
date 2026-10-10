import { expect, test, type Page } from "@playwright/test";
import interpretation from "./fixtures/idea-interpret.json";

// Gemini is stubbed on the server through AI_STUB_DIR (this folder's fixtures); embeddings and Neon are real.
test.use({ trace: "off" }); // traces would hold the session cookie
const view = (page: Page) => page.getByRole("article", { name: "Decision snapshot" });

test("choose a version: its snapshot stays the same after a new revision, and prints alone", async ({ page }) => {
  test.setTimeout(180_000);
  expect(process.env.AI_STUB_DIR, "Start the server with AI_STUB_DIR=tests/e2e/decision-snapshot-ui/fixtures").toBeTruthy();
  await page.goto("/");
  await expect(page.locator("[data-workspace-id]")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals.");
  await page.getByRole("button", { name: "Interpret" }).click();
  await page.getByRole("region", { name: "Your idea" }).getByRole("button", { name: "Save" }).click();
  const revisions = page.getByRole("region", { name: "Revisions" });
  await expect(revisions).toHaveAttribute("data-trail-length", "1", { timeout: 60_000 });
  const v1 = (await revisions.getAttribute("data-current-version"))!;

  await page.getByRole("region", { name: "Decision" }).getByRole("button", { name: "Choose this version" }).click();
  await expect(view(page)).toHaveAttribute("data-version-id", v1, { timeout: 30_000 });
  await expect(view(page)).toContainText(interpretation.title);
  await expect(view(page)).toContainText(interpretation.workflow);
  // The view shows the stored JSON: its alternatives are the snapshot's.
  const stored = await (await page.request.get(`/api/snapshots/${await view(page).getAttribute("data-snapshot-id")}`)).json();
  await expect(view(page).getByRole("listitem")).toHaveCount(stored.nearestAlternatives.length);
  const before = await view(page).innerText();

  // A new revision becomes current; the snapshot view doesn't change.
  await revisions.getByRole("button", { name: "Suggest revisions" }).click();
  await revisions.getByRole("list", { name: "Suggestions" }).getByRole("button", { name: "Accept" }).nth(1).click();
  await expect(revisions).toHaveAttribute("data-trail-length", "2", { timeout: 60_000 });
  expect(await revisions.getAttribute("data-current-version")).not.toBe(v1);
  // Let every panel react to the new version (they refetch) before checking that the snapshot didn't.
  await page.waitForLoadState("networkidle");
  await expect(view(page)).toHaveAttribute("data-version-id", v1);
  expect(await view(page).innerText()).toBe(before);
  await page.screenshot({ path: test.info().outputPath("snapshot.png"), fullPage: true });

  // Printing shows only the snapshot.
  await page.emulateMedia({ media: "print" });
  await expect(view(page)).toBeVisible();
  await expect(revisions).toBeHidden();
  await expect(page.locator("canvas")).toBeHidden();
  await page.screenshot({ path: test.info().outputPath("print.png") });
});
