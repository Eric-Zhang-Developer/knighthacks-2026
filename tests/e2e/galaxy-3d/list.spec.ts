import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// The project list at 57k stars (specs/decisions/galaxy-project-list.md): up to 200 visible stars are all listed;
// past that, over the whole map it lists the clouds, and zoomed in (or without categories) the 50 projects nearest
// the middle of the view. Categories are a fixture by map sector, built from the committed stars.json ids.
type Star = { id: string; x: number; y: number; title: string; event?: string | null; year?: number | null; z: number };
const corpus = JSON.parse(readFileSync("public/corpus/stars.json", "utf8")) as { corpus_version: string; count: number; stars: Star[] };
const DOMAINS = [["health", "Health & wellbeing"], ["education", "Education"], ["finance", "Finance"], ["climate", "Climate & environment"]];
function classes() {
  const projects = Object.fromEntries(
    corpus.stars.map((p, i) => {
      const sector = Math.min(DOMAINS.length - 1, Math.floor(((Math.atan2(p.y, p.x) + Math.PI) / (2 * Math.PI)) * DOMAINS.length));
      const status = i % 53 === 0 ? "insufficient_text" : i % 37 === 0 ? "mixed" : "clear";
      return [p.id, { domain: status === "insufficient_text" ? null : DOMAINS[sector][0], status, runner_up: null, dev_tools: "unknown", dev_tools_evidence: null, prizes: [] }];
    }),
  );
  return { corpus_version: corpus.corpus_version, taxonomy_version: "1", model: "fixture", domains: DOMAINS.map(([id, label]) => ({ id, label })), projects };
}
const list = (page: Page) => page.locator("[data-list-mode]");
const rows = (page: Page) => list(page).getByRole("list", { name: "Projects" }).getByRole("button");
const titles = new Set(corpus.stars.map((s) => s.title));
const open = async (page: Page) => {
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
  await page.locator("summary", { hasText: /^Projects \(/ }).click();
};

test("over the whole map the list names the clouds; a cloud lists the projects nearest the view", async ({ page }, info) => {
  test.slow();
  await page.route("**/api/classes", (r) => r.fulfill({ json: classes() }));
  await page.goto("/");
  await expect(page.locator("[data-star-count]")).toHaveAttribute("data-classes", "ready", { timeout: 30_000 });
  await open(page);
  await expect(list(page)).toHaveAttribute("data-list-mode", "clouds");
  const clouds = list(page).getByRole("list", { name: "Clouds" }).getByRole("button");
  await expect(clouds).toHaveCount(DOMAINS.length + 2); // + mixed and not enough text
  // The list never renders every star: the clouds and at most 50 projects (it used to render all 57k rows).
  expect(await list(page).locator("li").count()).toBeLessThanOrEqual(DOMAINS.length + 2 + 50);
  const counts = (await clouds.allInnerTexts()).map((t) => Number(t.match(/([\d,]+) projects/)![1].replace(/,/g, "")));
  expect(counts.reduce((a, b) => a + b, 0)).toBe(corpus.stars.length);
  expect(counts).toEqual([...counts].sort((a, b) => b - a)); // largest first
  await page.screenshot({ path: info.outputPath("clouds.png") });

  await clouds.first().click();
  await expect(list(page)).toHaveAttribute("data-list-mode", "near", { timeout: 15_000 });
  await expect(rows(page).first()).toBeVisible();
  const n = await rows(page).count();
  expect(n).toBeGreaterThan(0);
  expect(n).toBeLessThanOrEqual(50);
  for (const t of await rows(page).allInnerTexts()) expect(titles.has(t.split("\n")[0])).toBe(true);
  await page.screenshot({ path: info.outputPath("near.png") });
  const title = (await rows(page).first().innerText()).split("\n")[0];
  await rows(page).first().click();
  const id = corpus.stars.find((s) => s.title === title)!.id;
  await expect(page.locator("[data-star-count]")).toHaveAttribute("data-selected-id", id);
});

test("without categories the list is the projects nearest the view", async ({ page }) => {
  test.slow(); // software GL draws 57k stars at about 2 frames a second
  await page.route("**/api/classes", (r) => r.fulfill({ status: 404, body: "" }));
  await page.goto("/");
  await open(page);
  await expect(list(page)).toHaveAttribute("data-list-mode", "near");
  await expect(rows(page).first()).toBeVisible({ timeout: 20_000 });
  expect(await rows(page).count()).toBeLessThanOrEqual(50);
  await expect(list(page)).toContainText(/nearest the middle of the view, of [\d,]+\./);
});

test("up to 200 stars are all listed", async ({ page }) => {
  const few = corpus.stars.slice(0, 150);
  await page.route("**/corpus/stars.json", (r) => r.fulfill({ json: { corpus_version: corpus.corpus_version, count: few.length, stars: few } }));
  await page.goto("/");
  await open(page);
  await expect(list(page)).toHaveAttribute("data-list-mode", "all");
  await expect(rows(page)).toHaveCount(150);
});
