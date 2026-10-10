import { copyFile, readdir, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Gemini is stubbed through AI_STUB_DIR, a fresh absolute temp folder: the static fixtures are copied in and
// compare.json is written once the real version IDs exist. Embeddings, placement and Neon are real.
test.use({ trace: "off" }); // traces would hold the session cookie
const CRITERIA = ["Originality", "Technical Understanding", "Functionality", "Design", "Wow Factor"];
const panel = (page: Page) => page.getByRole("region", { name: "Compare versions" });

test("pick two versions and get a reason and an uncertainty per criterion, with no scores", async ({ page }) => {
  test.setTimeout(180_000);
  const stub = process.env.AI_STUB_DIR;
  expect(stub && isAbsolute(stub), "Set AI_STUB_DIR to a fresh absolute temp folder").toBeTruthy();
  const fixtures = join(__dirname, "fixtures");
  for (const f of await readdir(fixtures)) await copyFile(join(fixtures, f), join(stub!, f));

  // Two versions of one idea: save it, then accept one revision.
  await page.goto("/");
  await expect(page.locator("[data-workspace-id]")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals.");
  await page.getByRole("button", { name: "Interpret" }).click();
  await page.getByRole("region", { name: "Your idea" }).getByRole("button", { name: "Save" }).click();
  const revisions = page.getByRole("region", { name: "Revisions" });
  await revisions.getByRole("button", { name: "Suggest revisions" }).click({ timeout: 60_000 });
  await revisions.getByRole("list", { name: "Suggestions" }).getByRole("button", { name: "Accept" }).first().click();
  await expect(revisions).toHaveAttribute("data-trail-length", "2", { timeout: 60_000 });

  const [latest] = (await (await page.request.get("/api/ideas")).json()) as { ideaId: string }[];
  const ids = ((await (await page.request.get(`/api/revisions/trail/${latest.ideaId}`)).json()) as { versionId: string }[]).map((v) => v.versionId);
  await writeFile(
    join(stub!, "compare.json"),
    // compare-api's compact generation matrix (#243): rows are CRITERIA, columns the requested versions in order.
    JSON.stringify({
      m: CRITERIA.map((name) =>
        ids.map((_versionId, i) => ({
          r: `${name} reason for the ${i ? "revised" : "original"} version`,
          l: "inferred",
          s: [],
          u: "Implementation quality and user demand remain unknown",
        })),
      ),
    }),
  );

  // Compare stays disabled until two are picked.
  const compare = panel(page).getByRole("button", { name: "Compare" });
  await panel(page).getByRole("checkbox", { name: /Version 1/ }).check();
  await expect(compare).toBeDisabled();
  await panel(page).getByRole("checkbox", { name: /Version 2/ }).check();
  await compare.click();

  const table = panel(page).getByRole("table", { name: "Comparison" });
  await expect(table.getByRole("columnheader")).toHaveText(["Criterion", "Version 1", "Version 2"], { timeout: 60_000 });
  await expect(table.getByRole("rowheader")).toHaveText(CRITERIA);
  const cells = table.getByRole("cell");
  await expect(cells).toHaveCount(CRITERIA.length * 2);
  for (const [i, name] of CRITERIA.entries()) {
    await expect(cells.nth(i * 2)).toContainText(`${name} reason for the original version`);
    await expect(cells.nth(i * 2 + 1)).toContainText(`${name} reason for the revised version`);
    await expect(cells.nth(i * 2)).toContainText("Uncertain: Implementation quality");
    await expect(cells.nth(i * 2)).toContainText("inferred");
  }
  // Nothing in the table body reads as a score.
  expect(await table.locator("tbody").innerText()).not.toMatch(/\d|%/);
  await page.screenshot({ path: test.info().outputPath("compare.png"), fullPage: true });
});
