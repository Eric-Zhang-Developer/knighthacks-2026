import { expect, test, type Page } from "@playwright/test";

// galaxy-3d Validation 4: the camera moves like a map. Reduced motion, so there's no drift, glide or spring and only
// the input moves the camera.
type Pt = { x: number; y: number };
type Canvas = HTMLCanvasElement & { starPositions: ArrayLike<number>; starView: { moving: boolean }; starScreen(idx: number[]): Pt[] };

const canvas = (page: Page) => page.locator("canvas");
async function ready(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?layout=clouds");
  await expect(page.locator("[data-star-count]")).toHaveAttribute("data-classes", "ready");
  await expect.poll(() => canvas(page).evaluate((c) => "starScreen" in c)).toBe(true);
  return (await canvas(page).boundingBox())!;
}
const frame = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const screenOf = async (page: Page, idx: number[]) => {
  await frame(page);
  return canvas(page).evaluate((c, idx) => (c as Canvas).starScreen(idx), idx);
};
const buffer = (page: Page) => canvas(page).evaluate((c) => Array.from((c as Canvas).starPositions));
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
// A star that's on screen near a spot, so it's one the person could be pointing at.
async function starNear(page: Page, at: Pt) {
  const n = Number(await page.locator("[data-star-count]").getAttribute("data-star-count"));
  const all = await screenOf(page, Array.from({ length: n }, (_, i) => i));
  let best = 0;
  all.forEach((s, i) => dist(s, at) < dist(all[best], at) && (best = i));
  return best;
}

test("a drag moves across the map; the stars stay put", async ({ page }) => {
  const box = await ready(page);
  const i = await starNear(page, { x: box.width * 0.3, y: box.height * 0.6 });
  const before = await buffer(page);
  const [a] = await screenOf(page, [i]);
  await page.mouse.move(box.x + a.x, box.y + a.y);
  await page.mouse.down();
  await page.mouse.move(box.x + a.x + 180, box.y + a.y - 90, { steps: 12 });
  await page.mouse.up();
  const [b] = await screenOf(page, [i]);
  expect(Math.abs(b.x - a.x - 180)).toBeLessThanOrEqual(3);
  expect(Math.abs(b.y - a.y + 90)).toBeLessThanOrEqual(3);
  expect(await buffer(page)).toEqual(before);
});

test("the wheel zooms toward the pointer, not the middle", async ({ page }, info) => {
  const box = await ready(page);
  const spot = { x: box.width * 0.75, y: box.height * 0.35 };
  const i = await starNear(page, spot);
  const [a] = await screenOf(page, [i]);
  const [c, d] = await screenOf(page, [await starNear(page, { x: a.x + 40, y: a.y }), await starNear(page, { x: a.x - 40, y: a.y + 30 })]);
  await page.mouse.move(box.x + a.x, box.y + a.y);
  for (let k = 0; k < 3; k++) await page.mouse.wheel(0, -120);
  const [a2] = await screenOf(page, [i]);
  const [c2, d2] = await screenOf(page, [await starNear(page, c), await starNear(page, d)]);
  expect(dist(a2, a)).toBeLessThanOrEqual(8);
  expect(dist(c2, d2)).toBeGreaterThan(dist(c, d));
  await page.screenshot({ path: info.outputPath("zoomed-at-pointer.png") });
});

test("a cloud's label flies to that cloud", async ({ page }, info) => {
  const box = await ready(page);
  const label = page.getByRole("button", { name: /^Go to / }).first();
  await expect(label).toBeVisible();
  await label.click();
  await frame(page);
  const anchor = await label.locator("..").evaluate((el) => {
    const m = (el as HTMLElement).style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/)!;
    return { x: Number(m[1]), y: Number(m[2]) };
  });
  expect(dist(anchor, { x: box.width / 2, y: box.height / 2 })).toBeLessThanOrEqual(12);
  await page.screenshot({ path: info.outputPath("flew-to-cloud.png") });
});
