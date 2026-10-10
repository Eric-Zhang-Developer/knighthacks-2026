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
  await expect(similar.getByRole("button").first()).toHaveAttribute("aria-current", "true");
  await box.fill("");
  await expect(page.getByLabel("Search results")).toHaveCount(0);
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
