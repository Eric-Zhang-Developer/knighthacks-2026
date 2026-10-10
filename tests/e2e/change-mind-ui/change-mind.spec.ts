import { copyFile, readdir, unlink } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Real backend on the Neon test branch; the model is stubbed through AI_STUB_DIR (a fresh absolute temp folder this
// test copies its fixtures into) with AI_STUB_ALLOW=1.
test.use({ trace: "off" }); // traces would hold the session cookie
const fixtures = join(__dirname, "fixtures");
const section = (page: Page) => page.getByRole("region", { name: "Challenge" }).getByRole("region", { name: "What would change your mind?" });

test("save an idea: its assumptions appear by kind, each with a reversal or 'evidence is insufficient'", async ({ page }) => {
  test.setTimeout(180_000);
  const stub = process.env.AI_STUB_DIR;
  expect(stub && isAbsolute(stub), "Set AI_STUB_DIR to a fresh absolute temp folder").toBeTruthy();
  for (const f of await readdir(fixtures)) await copyFile(join(fixtures, f), join(stub!, f));

  await page.goto("/");
  await expect(page.locator("[data-workspace-id]")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals.");
  await page.getByRole("button", { name: "Interpret" }).click();
  await page.getByRole("region", { name: "Your idea" }).getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("region", { name: "Revisions" })).toHaveAttribute("data-trail-length", "1", { timeout: 60_000 });

  await section(page).getByRole("button", { name: "List my assumptions" }).click();
  // Grouped in a fixed order: need, data, feasibility (no differentiation here).
  const groups = section(page).getByRole("list");
  await expect(groups).toHaveCount(3, { timeout: 30_000 });
  await expect(groups.nth(0)).toHaveAccessibleName("Need");
  await expect(groups.nth(1)).toHaveAccessibleName("Data");
  await expect(groups.nth(2)).toHaveAccessibleName("Feasibility");

  const need = groups.nth(0).getByRole("listitem");
  await expect(need).toContainText("unverified");
  await expect(need).toContainText("Teams lose real building time choosing meals.");
  await expect(need).toContainText("Check: Ask five teams how long choosing a meal takes");
  await expect(need).toContainText("Changes my mind if: Most say under five minutes");
  // Insufficient evidence reads as such, never as a pass.
  const data = groups.nth(1).getByRole("listitem");
  await expect(data).toContainText("inferred");
  await expect(data).toContainText("Evidence is insufficient");
  await expect(data).not.toContainText("Check:");
  await expect(groups.nth(2).getByRole("listitem")).toContainText("inferred");
  await section(page).screenshot({ path: test.info().outputPath("change-mind.png") });

  // After reload the stored list comes back on its own; with the fixture gone, a model call would fail.
  await unlink(join(stub!, "assumptions.json"));
  await page.reload();
  await expect(section(page).getByRole("list")).toHaveCount(3, { timeout: 30_000 });
  await expect(section(page).getByRole("button", { name: "List my assumptions" })).toHaveCount(0);
});
