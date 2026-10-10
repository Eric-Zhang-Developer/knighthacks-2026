import { expect, test, type Page } from "@playwright/test";
import fixture from "../../galaxy/stars.synthetic.json";

// Serves the synthetic fixture (made-up coordinates) so star positions on screen are known: the camera aims at
// the centre of the cloud, where "synthetic-center" sits.
test.beforeEach(async ({ page }) => {
  await page.route("**/corpus/stars.json", (r) => r.fulfill({ json: fixture }));
});

const galaxy = (page: Page) => page.locator("[data-star-count]");
const tooltip = (page: Page) => page.getByRole("tooltip").filter({ hasText: "Synthetic center star" });

async function canvasCenter(page: Page) {
  const box = (await page.locator("canvas").boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

async function hoverCenter(page: Page, dx = 0) {
  const { x, y } = await canvasCenter(page);
  await page.mouse.move(x + dx - 30, y);
  await page.mouse.move(x + dx, y);
}

async function rightDrag(page: Page, by: number) {
  const { x, y } = await canvasCenter(page);
  await page.mouse.move(x, y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(x + by, y + by, { steps: 10 });
  await page.mouse.up({ button: "right" });
}

test("renders every star in stars.json", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("/");
  await expect(galaxy(page)).toHaveAttribute("data-star-count", String(fixture.count));
  await expect(page.getByRole("status")).toHaveText(`${fixture.count} projects indexed`);
  await expect(page.locator("canvas")).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("galaxy.png") });
  expect(errors).toEqual([]);
});

test("hover shows the title; click selects; the camera holds while selected", async ({ page }) => {
  await page.goto("/");
  await expect(async () => {
    await hoverCenter(page);
    await expect(tooltip(page)).toBeVisible({ timeout: 500 });
  }).toPass();

  const { x, y, box } = await canvasCenter(page);
  await page.mouse.click(x, y);
  await expect(galaxy(page)).toHaveAttribute("data-selected-id", "synthetic-center");

  // Selected: panning does nothing, so the star is still under the centre.
  await rightDrag(page, 150);
  await hoverCenter(page);
  await expect(tooltip(page)).toBeVisible();

  // Clicking empty space clears the selection and frees the camera: the same pan now moves the star away.
  await page.mouse.click(box.x + box.width - 20, box.y + 20);
  await expect(galaxy(page)).toHaveAttribute("data-selected-id", "");
  await rightDrag(page, 150);
  await hoverCenter(page);
  await expect(tooltip(page)).toBeHidden();
});

test("a star's edge stays clickable zoomed far out and close in", async ({ page }) => {
  await page.goto("/");
  await expect(async () => {
    await hoverCenter(page);
    await expect(tooltip(page)).toBeVisible({ timeout: 500 });
  }).toPass();
  const { x, y, box } = await canvasCenter(page);

  for (const delta of [2000, -4000]) {
    await page.mouse.move(x, y);
    for (let i = 0; i < 5; i++) await page.mouse.wheel(0, delta / 5);
    await page.mouse.click(box.x + box.width - 20, box.y + 20); // reset selection
    await page.mouse.click(x + 4, y + 1);
    await expect(galaxy(page)).toHaveAttribute("data-selected-id", "synthetic-center");
    await page.mouse.click(box.x + box.width - 20, box.y + 20);
  }
});

test("the keyboard list selects the same star", async ({ page }) => {
  await page.goto("/");
  const summary = page.getByText(`Projects (${fixture.count})`);
  await summary.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: /Synthetic center star/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(galaxy(page)).toHaveAttribute("data-selected-id", "synthetic-center");
  await expect(page.getByRole("button", { name: /Synthetic center star/ })).toHaveAttribute("aria-pressed", "true");
});
