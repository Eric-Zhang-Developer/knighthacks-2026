import { expect, test, type Page } from "@playwright/test";
import fixture from "../../galaxy-history/stars.synthetic.json";

// Synthetic years 2019 (2), 2021 (2), 2023 (1) and one star with no year; "synthetic-center" sits where the
// camera aims.
test.beforeEach(async ({ page }) => {
  await page.route("**/corpus/stars.json", (r) => r.fulfill({ json: fixture }));
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
});

const galaxy = (page: Page) => page.locator("[data-star-count]");
const scrub = (page: Page) => page.getByRole("slider", { name: "Created year" });
const expected = fixture.stars.flatMap((s) => [s.x, s.y, s.z].map(Math.fround));
const visibleAt = (year: number) => fixture.stars.filter((s) => s.year === null || s.year <= year).length;

// The live GPU position buffer, which the reveal must never change.
async function positions(page: Page) {
  await expect.poll(() => page.locator("canvas").evaluate((c) => "starPositions" in c)).toBe(true);
  return page.locator("canvas").evaluate((c) => Array.from((c as unknown as { starPositions: ArrayLike<number> }).starPositions));
}

test("scrubbing hides later stars and never moves one", async ({ page }) => {
  const years = [2019, 2021, 2023];
  for (const [i, year] of years.entries()) {
    await scrub(page).fill(String(i));
    await expect(galaxy(page)).toHaveAttribute("data-visible-count", String(visibleAt(year)));
    await expect(page.getByText(`Created through ${year}`)).toBeVisible();
    expect(await positions(page)).toEqual(expected);
    if (i === 1) await page.screenshot({ path: test.info().outputPath("mid-reveal.png") });
  }
  // Earliest year: the 2019 pair plus the star with no year.
  await scrub(page).fill("0");
  await expect(galaxy(page)).toHaveAttribute("data-visible-count", "3");
  await expect(page.getByText("1 date unknown", { exact: false })).toBeVisible();
});

test("tooltip and list say 'created <year>', never '<event> · <year>'", async ({ page }) => {
  const tooltip = page.getByRole("tooltip");
  await expect(async () => {
    // Re-read each try: the canvas starts at 300x150 until R3F sizes it.
    const box = (await page.locator("canvas").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2 - 30, box.y + box.height / 2);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(tooltip).toBeVisible({ timeout: 500 });
  }).toPass();
  await expect(tooltip).toContainText("created 2019");
  await expect(tooltip).not.toContainText("· 2019");

  await page.getByText(`Projects (${fixture.count})`).click();
  const list = page.getByRole("list", { name: "Projects" });
  await expect(list.getByRole("button", { name: /Synthetic center star/ })).toContainText("created 2019");
  await expect(list.getByRole("button", { name: /Synthetic star E/ })).toContainText("date unknown");
  await expect(list).not.toContainText(/· \d{4}/);
});

test("play runs to the end and every star is visible again", async ({ page }) => {
  await page.getByRole("combobox", { name: "Speed" }).selectOption("2");
  await page.getByRole("button", { name: "Play" }).click();
  await expect(galaxy(page)).toHaveAttribute("data-visible-count", String(visibleAt(2019)));
  await expect(galaxy(page)).toHaveAttribute("data-visible-count", String(fixture.count), { timeout: 5000 });
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  expect(await positions(page)).toEqual(expected);
});

test("reduced motion turns play into stepping", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByRole("button", { name: "Play" })).toHaveCount(0);
  await page.getByRole("button", { name: "Step" }).click();
  await expect(galaxy(page)).toHaveAttribute("data-visible-count", String(visibleAt(2019)));
  await page.getByRole("button", { name: "Step" }).click();
  await expect(galaxy(page)).toHaveAttribute("data-visible-count", String(visibleAt(2021)));
});
