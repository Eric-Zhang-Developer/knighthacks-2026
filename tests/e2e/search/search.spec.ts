import { readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Real records from the corpus fixture; the loaded corpus contains them (changes/corpus-embed.md).
const fixture = readFileSync("corpus/fixtures/sample.jsonl", "utf8")
  .split("\n")
  .filter(Boolean)
  .slice(0, 3)
  .map((l) => JSON.parse(l) as { id: string; title: string });

test("a fixture title finds that project first, by meaning", async ({ request }) => {
  for (const r of fixture) {
    const res = await request.get(`/api/search?q=${encodeURIComponent(r.title)}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.meaning).toBe("ok");
    expect(body.results[0].id, r.title).toBe(r.id);
    expect(body.results[0].similarity).toBeGreaterThan(body.results[1].similarity);
  }
  const res = await request.get(`/api/search?q=${encodeURIComponent(fixture[0].title)}`);
  writeFileSync(test.info().outputPath("search-response.json"), await res.body());
});

test("type a query: results list; clear: list gone", async ({ page }) => {
  await page.goto("/");
  const box = page.getByRole("searchbox", { name: "Search projects" });
  await box.fill(fixture[0].title);
  const similar = page.getByRole("list", { name: "Similar projects" });
  await expect(similar.getByRole("button").first()).toContainText(fixture[0].title);
  await page.screenshot({ path: test.info().outputPath("search-results.png") });
  await similar.getByRole("button").first().click();
  // Picking a result folds the panel away (#457), so it no longer covers the map; the box brings it back.
  const panel = page.getByLabel("Search results");
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Project" }).getByRole("heading")).toHaveText(fixture[0].title);
  await box.click();
  await expect(similar.getByRole("button").first()).toHaveAttribute("aria-current", "true");
  // A click on the map, or Escape, folds it too; with it folded, Escape clears the query.
  const map = page.getByRole("main", { name: "Galaxy" });
  const area = (await map.boundingBox())!;
  await page.mouse.click(area.x + area.width * 0.6, area.y + area.height * 0.6); // below the panel, above the voice bar
  await expect(panel).toHaveCount(0);
  await box.click();
  await expect(panel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(box).toHaveValue(fixture[0].title);
  await page.keyboard.press("Escape");
  await expect(box).toHaveValue("");
  await box.fill(fixture[0].title);
  await expect(panel).toBeVisible();
  await box.fill("");
  await expect(panel).toHaveCount(0);
});

test("meaning search down: title matches with a notice, not an error page", async ({ page }) => {
  await page.route("**/api/search?*", (r) =>
    r.fulfill({ json: { results: [], textMatches: [{ ...fixture[0], tagline: null, event: null, year: null }], meaning: "unavailable" } }),
  );
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search projects" }).fill("anything");
  await expect(page.getByText("Meaning search unavailable; showing title matches.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Title matches" })).toContainText(fixture[0].title);
});
