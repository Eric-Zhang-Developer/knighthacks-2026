import { expect, test, type Page } from "@playwright/test";

// The flat map (specs/features/galaxy-2d, Validation 1-4), on the committed corpus. The view is read back through
// the canvas (as `galaxy` reads the position buffer), so star screen positions are exact, not guessed from pixels.
type Pt = { x: number; y: number };

const ready = async (page: Page) => {
  await expect.poll(() => page.locator("canvas").evaluate((c) => "starView" in c && "starPositions" in c)).toBe(true);
  return (await page.locator("canvas").boundingBox())!;
};
// Screen positions (canvas pixels) of stars by index, after the view settles.
const screenOf = async (page: Page, idx: number[]): Promise<Pt[]> => {
  await expect.poll(() => page.locator("canvas").evaluate((c) => (c as unknown as { starView: { moving: boolean } }).starView.moving)).toBe(false);
  return page.locator("canvas").evaluate((c, idx) => {
    const { starView: v, starPositions: p } = c as unknown as { starView: { toScreen(x: number, y: number): Pt }; starPositions: ArrayLike<number> };
    return idx.map((i) => v.toScreen(p[3 * i], p[3 * i + 1]));
  }, idx);
};
const zoom = (page: Page) => page.locator("canvas").evaluate((c) => (c as unknown as { starView: { zoom: number } }).starView.zoom);
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

test("drag pans 1:1 without rotating; wheel zooms about the pointer", async ({ page }, info) => {
  await page.goto("/");
  const box = await ready(page);
  await page.screenshot({ path: info.outputPath("desktop.png") });

  // 1. Drag 200px right, holding still before release so there's no glide.
  const [a, b] = await screenOf(page, [0, 1]);
  await page.mouse.move(box.x + 40, box.y + box.height - 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 240, box.y + box.height - 40, { steps: 12 });
  await page.waitForTimeout(200);
  await page.mouse.up();
  const [a2, b2] = await screenOf(page, [0, 1]);
  expect(Math.abs(a2.x - a.x - 200)).toBeLessThanOrEqual(2);
  expect(Math.abs(a2.y - a.y)).toBeLessThanOrEqual(2);
  expect(Math.abs(b2.x - b.x - 200)).toBeLessThanOrEqual(2);
  expect(Math.abs(dist(a2, b2) - dist(a, b))).toBeLessThanOrEqual(0.5);

  // 2. Wheel in over star 0: it stays under the pointer while the gap between two others grows.
  const [c, d] = await screenOf(page, [2, 3]);
  await page.mouse.move(box.x + a2.x, box.y + a2.y);
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -150);
  const [a3, c3, d3] = await screenOf(page, [0, 2, 3]);
  expect(dist(a3, a2)).toBeLessThanOrEqual(3);
  expect(dist(c3, d3)).toBeGreaterThan(dist(c, d) * 1.5);
  await page.screenshot({ path: info.outputPath("zoomed.png") });
});

test("picking a project flies to it; fit all shows every star; + - 0 keys", async ({ page }, info) => {
  await page.goto("/");
  const box = await ready(page);

  // 3. Pick a project in the list: within 1 s it's at the centre (±4px).
  await page.locator("summary", { hasText: /^Projects \(/ }).click();
  const list = page.getByRole("list", { name: "Projects" });
  await list.getByRole("button").nth(40).click();
  const id = await page.locator("[data-star-count]").getAttribute("data-selected-id");
  const index = await page.evaluate((id) => fetch("/corpus/stars.json").then((r) => r.json()).then((s) => s.stars.findIndex((x: { id: string }) => x.id === id)), id);
  await page.waitForTimeout(1000);
  const [at] = await page.locator("canvas").evaluate((c, i) => {
    const { starView: v, starPositions: p } = c as unknown as { starView: { toScreen(x: number, y: number): Pt }; starPositions: ArrayLike<number> };
    return [v.toScreen(p[3 * i], p[3 * i + 1])];
  }, index);
  expect(dist(at, { x: box.width / 2, y: box.height / 2 })).toBeLessThanOrEqual(4);
  await page.getByRole("region", { name: "Project" }).getByRole("button", { name: "Close" }).click();

  // 4. Fit all: every star inside the map. Keys do the same as the buttons.
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Show the whole map" }).click();
  const n = Number(await page.locator("[data-star-count]").getAttribute("data-star-count"));
  const all = await screenOf(page, Array.from({ length: n }, (_, i) => i));
  expect(all.every((p) => p.x >= 0 && p.y >= 0 && p.x <= box.width && p.y <= box.height)).toBe(true);
  const fit = await zoom(page);
  await page.getByLabel(/^Star map/).focus();
  await page.keyboard.press("+");
  await screenOf(page, [0]);
  expect(await zoom(page)).toBeGreaterThan(fit * 1.5);
  await page.keyboard.press("-");
  await page.keyboard.press("0");
  await screenOf(page, [0]);
  expect(Math.abs((await zoom(page)) / fit - 1)).toBeLessThan(0.01);

  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.screenshot({ path: info.outputPath("phone.png") });
});

test("reduced motion: picking a project jumps there in the next frame", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const box = await ready(page);
  await page.locator("summary", { hasText: /^Projects \(/ }).click();
  await page.getByRole("list", { name: "Projects" }).getByRole("button").nth(7).click();
  const moving = await page.locator("canvas").evaluate((c) => (c as unknown as { starView: { moving: boolean } }).starView.moving);
  expect(moving).toBe(false);
  const id = await page.locator("[data-star-count]").getAttribute("data-selected-id");
  const index = await page.evaluate((id) => fetch("/corpus/stars.json").then((r) => r.json()).then((s) => s.stars.findIndex((x: { id: string }) => x.id === id)), id);
  const at = await page.locator("canvas").evaluate((c, i) => {
    const { starView: v, starPositions: p } = c as unknown as { starView: { toScreen(x: number, y: number): Pt }; starPositions: ArrayLike<number> };
    return v.toScreen(p[3 * i], p[3 * i + 1]);
  }, index);
  expect(dist(at, { x: box.width / 2, y: box.height / 2 })).toBeLessThanOrEqual(4);
});
