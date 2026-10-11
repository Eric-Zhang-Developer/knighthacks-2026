import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// classes.json comes from corpus-classify. Until it lands this suite serves a fixture with the #269 contract, built
// from the real committed stars.json so its ids and corpus_version match: domains by map sector (so some are compact
// enough to label), a few mixed and not-enough-text projects, and placement, sponsor and participation prizes.
// Gemini is stubbed for the saved idea; embeddings and Neon are real. Traces would hold the session cookie.
test.use({ trace: "off" });
type Star = { id: string; x: number; y: number; title: string; event?: string | null };
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const corpus = JSON.parse(readFileSync(join(process.cwd(), "public/corpus/stars.json"), "utf8")) as { corpus_version: string; stars: Star[] };
const DOMAINS = [["health", "Health & wellbeing"], ["education", "Education"], ["finance", "Finance"], ["climate", "Climate & environment"]];
function fixture() {
  const cx = corpus.stars.reduce((s, p) => s + p.x, 0) / corpus.stars.length;
  const cy = corpus.stars.reduce((s, p) => s + p.y, 0) / corpus.stars.length;
  const projects = Object.fromEntries(corpus.stars.map((p, i) => {
    const sector = Math.min(DOMAINS.length - 1, Math.floor(((Math.atan2(p.y - cy, p.x - cx) + Math.PI) / (2 * Math.PI)) * DOMAINS.length));
    const status = i % 53 === 0 ? "insufficient_text" : i % 37 === 0 ? "mixed" : "clear";
    const prize = (text: string, kind: string, place: number | null, sponsor: string | null) => [{ event: p.event ?? null, text, kind, place, sponsor }];
    const prizes = i % 41 === 0 ? prize("1st Place Overall", "placement", 1, null) : i % 47 === 0 ? prize("Best Use of Neon", "sponsor", null, "Neon")
      : i % 29 === 0 ? prize("Participation Certificates", "participation", null, null) : [];
    return [p.id, { domain: status === "insufficient_text" ? null : DOMAINS[sector][0], status, runner_up: status === "mixed" ? "education" : null, dev_tools: "unknown", dev_tools_evidence: null, prizes }];
  }));
  return { corpus_version: corpus.corpus_version, taxonomy_version: "1", model: "fixture", domains: DOMAINS.map(([id, label]) => ({ id, label })), projects };
}
const galaxy = (page: Page) => page.locator("[data-star-count]");
const legend = (page: Page) => page.getByRole("region", { name: "Categories" });
const count = (s: string) => Number(s.replace(/,/g, ""));
const listed = (page: Page) => page.getByLabel("Galaxy", { exact: true }).getByRole("list", { name: "Projects" }).locator("li:not([hidden])");
// Up to 200 visible stars are all listed; past that the list holds at most the 50 nearest the view (specs/decisions/
// galaxy-project-list.md), every one of them still inside the filter.
async function expectListed(page: Page, n: number, each?: string) {
  if (n <= 200) return expect(listed(page)).toHaveCount(n);
  const list = page.locator("[data-list-mode]");
  if ((await list.getAttribute("data-list-mode")) === "clouds") await list.getByRole("list", { name: "Clouds" }).getByRole("button").first().click();
  await expect(listed(page).first()).toBeVisible({ timeout: 15_000 });
  expect(await listed(page).count()).toBeLessThanOrEqual(50);
  if (each) for (const t of await listed(page).allInnerTexts()) expect(t).toContain(each);
}

test("categories colour, filter and ring the galaxy, and an idea focuses on its stored neighbours", async ({ page }, info) => {
  test.setTimeout(180_000);
  expect(process.env.AI_STUB_DIR, "Start the server with AI_STUB_DIR=tests/e2e/idea-create-ui/fixtures").toBeTruthy();
  // Before corpus-classify publishes the file, the pass-through answers 204 (no logged 404); then it serves the file.
  expect([200, 204]).toContain((await page.request.get("/api/classes")).status());
  await page.route("**/api/classes", (r) => r.fulfill({ json: fixture() }));
  await page.goto("/");
  await expect(galaxy(page)).toHaveAttribute("data-classes", "ready", { timeout: 30_000 });
  const total = Number(await galaxy(page).getAttribute("data-star-count"));

  // 1. The legend's entries are counted from the file and sum to the corpus.
  const entries = legend(page).locator("button[data-key]");
  await expect(entries).toHaveCount(DOMAINS.length + 2); // + mixed and not enough text
  const counts = await entries.locator("span:last-child").allTextContents();
  expect(counts.map(count).reduce((a, b) => a + b, 0)).toBe(total);
  await page.screenshot({ path: info.outputPath("desktop.png") });

  // 2. A domain filters the map and the list to its count; Reset brings everything back.
  const finance = legend(page).getByRole("button", { name: /Finance/ });
  const financeCount = count(await finance.locator("span:last-child").innerText());
  await finance.click();
  await expect(finance).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Search results")).toHaveCount(0); // the legend doesn't pop the search panel open
  await expect(galaxy(page)).toHaveAttribute("data-visible-count", String(financeCount));
  await page.locator("summary", { hasText: /^Projects \(/ }).click();
  await expectListed(page, financeCount, "Finance (inferred)");
  await legend(page).getByRole("button", { name: "Reset" }).click();
  await expect(galaxy(page)).toHaveAttribute("data-visible-count", String(total));

  // 3. Prize winners: only ringed stars remain (participation doesn't count), and the drawer shows the prize.
  const winners = legend(page).getByRole("button", { name: /Prize winners/ });
  const winnerCount = count(await winners.locator("span:last-child").innerText());
  await winners.click();
  await expect(galaxy(page)).toHaveAttribute("data-visible-count", String(winnerCount));
  await expect(galaxy(page)).toHaveAttribute("data-ring-count", String(winnerCount));
  await expectListed(page, winnerCount);
  // A listed winner (1st place or a sponsor prize in the fixture) shows its prize in the drawer.
  const row = listed(page).getByRole("button").first();
  const title = (await row.innerText()).split("\n")[0];
  const first = corpus.stars.find((p) => p.title === title)!;
  await row.click();
  const prizes = page.getByRole("region", { name: "Project" }).getByRole("list", { name: "Prizes" });
  await expect(prizes).toContainText(/1st Place Overall|Best Use of Neon/);
  await expect(prizes).toContainText(new RegExp(`${escape(first.event ?? "event unknown")} · (placement · 1st|sponsor)`));
  await expect(page.getByRole("region", { name: "Project" })).toContainText("inferred");
  await legend(page).getByRole("button", { name: "Reset" }).click();
  await page.getByRole("region", { name: "Project" }).getByRole("button", { name: /Close/ }).click();

  // 4. Idea focus: one line per stored neighbour, every other star dimmed; clearing the focus restores the map.
  await page.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals.");
  await page.getByRole("region", { name: "Your idea" }).getByRole("button", { name: "Interpret" }).click();
  await page.getByRole("region", { name: "Your idea" }).getByRole("button", { name: "Save" }).click({ timeout: 60_000 });
  await expect(page.getByRole("region", { name: "Your idea" })).toHaveAttribute("data-version-id", /.+/, { timeout: 60_000 });
  const [latest] = (await (await page.request.get("/api/ideas")).json()) as { neighborIds: string[] }[];
  await expect(galaxy(page)).toHaveAttribute("data-line-count", String(latest.neighborIds.length), { timeout: 30_000 });
  await expect(galaxy(page)).toHaveAttribute("data-dimmed-count", String(total - latest.neighborIds.length));
  await page.screenshot({ path: info.outputPath("focus.png") });
  await legend(page).getByRole("button", { name: "Show the whole map" }).click();
  await expect(galaxy(page)).toHaveAttribute("data-line-count", "0");
  await expect(galaxy(page)).toHaveAttribute("data-dimmed-count", "0");

  // Phone width: the legend and filters fit with no sideways scroll.
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: info.outputPath("phone.png"), fullPage: true });
});
