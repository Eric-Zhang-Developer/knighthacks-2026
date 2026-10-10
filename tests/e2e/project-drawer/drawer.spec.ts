import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// A real record from the corpus fixture, which the loaded corpus contains (changes/corpus-embed.md).
const record = JSON.parse(readFileSync("corpus/fixtures/sample.jsonl", "utf8").split("\n")[0]) as {
  id: string;
  url: string;
  title: string;
};

test("click a star: the drawer opens with that project and its source link", async ({ page }) => {
  // Only this star in the galaxy, so the camera aims straight at it (the position is a test placement).
  await page.route("**/corpus/stars.json", (r) =>
    r.fulfill({ json: { corpus_version: "test", count: 1, stars: [{ id: record.id, x: 0, y: 0, z: 0, title: record.title, event: null, year: null }] } }),
  );
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const drawer = page.getByRole("region", { name: "Project" });
  await expect(async () => {
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(drawer).toBeVisible({ timeout: 1000 });
  }).toPass();
  await expect(drawer.getByRole("heading")).toHaveText(record.title);
  await expect(drawer.getByRole("link", { name: /^Source:/ })).toHaveAttribute("href", record.url);
  await page.screenshot({ path: test.info().outputPath("drawer.png") });

  await drawer.getByRole("button", { name: "Close" }).click();
  await expect(drawer).toHaveCount(0);
});

test("unknown id: 404, and the drawer says not found", async ({ page, request }) => {
  expect((await request.get(`/api/projects/${"0".repeat(40)}`)).status()).toBe(404);
  await page.route("**/corpus/stars.json", (r) =>
    r.fulfill({ json: { corpus_version: "test", count: 1, stars: [{ id: "0".repeat(40), x: 0, y: 0, z: 0, title: "Missing", event: null, year: null }] } }),
  );
  await page.goto("/");
  await page.getByText(/^Projects \(1\)$/).click();
  await page.getByRole("list", { name: "Projects" }).getByRole("button").click();
  await expect(page.getByRole("region", { name: "Project" })).toContainText("Project not found.");
});
