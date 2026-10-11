import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

// The board reads the published corpus files; this test recomputes every count from the same files, independently.
const root = join(__dirname, "..", "..", "..", "public");
const stars = JSON.parse(readFileSync(join(root, "corpus", "stars.json"), "utf8")) as { corpus_version: string; stars: { id: string; year: number | null }[] };
const classes = JSON.parse(readFileSync(join(root, "classify", "classes.json"), "utf8")) as { corpus_version: string; projects: Record<string, { dev_tools: string }> };

const ERA = {
  "through-2022": (y: number | null) => y !== null && y <= 2022,
  "2023-2024": (y: number | null) => y !== null && y >= 2023 && y <= 2024,
  "2025-on": (y: number | null) => y !== null && y >= 2025,
  unknown: (y: number | null) => y === null,
};

test("the explainer's era board: rows sum to the corpus, tool use sums to each row, counts match the files", async ({ page }) => {
  expect(classes.corpus_version, "classes.json must be for the published corpus").toBe(stars.corpus_version);
  await page.goto("/");
  const explainer = page.locator('[data-panel="explainer"]');
  await explainer.getByText("What am I looking at?").click();
  const board = explainer.getByRole("region", { name: "AI tools and eras" });
  await expect(board.locator('[data-count="reported"]').first()).toBeVisible({ timeout: 30_000 });
  const total = Number((await explainer.getByTestId("explainer-count").textContent())?.replace(/,/g, ""));
  expect(total).toBe(stars.stars.length);

  // Shown formatted ("7,908"); data-value carries the raw count, and the text must match it.
  const num = async (era: string, col: string) => {
    const cell = board.locator(`[data-era="${era}"] [data-count="${col}"]`);
    const value = Number(await cell.getAttribute("data-value"));
    expect(Number((await cell.textContent())!.replace(/,/g, "")), `${era} ${col} text`).toBe(value);
    return value;
  };
  let sum = 0;
  for (const [era, has] of Object.entries(ERA)) {
    const inEra = stars.stars.filter((s) => has(s.year ?? null));
    const projects = await num(era, "projects");
    expect(projects, era).toBe(inEra.length);
    const tools = { reported: await num(era, "reported"), reported_non_use: await num(era, "reported_non_use"), unknown: await num(era, "unknown") };
    expect(tools.reported + tools.reported_non_use + tools.unknown, `${era}: tool use sums to the row`).toBe(projects);
    expect(tools.reported, era).toBe(inEra.filter((s) => classes.projects[s.id]?.dev_tools === "reported").length);
    expect(tools.reported_non_use, era).toBe(inEra.filter((s) => classes.projects[s.id]?.dev_tools === "reported_non_use").length);
    sum += projects;
  }
  expect(sum, "the four rows sum to the corpus count").toBe(total);

  await expect(board).toContainText("started this project");
  await expect(board.getByRole("list", { name: "Tool releases" }).getByRole("link")).toHaveCount(3);
  await board.scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("era-board.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await board.scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("era-board-phone.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
