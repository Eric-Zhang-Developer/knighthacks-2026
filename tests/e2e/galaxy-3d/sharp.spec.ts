import { expect, test, type Page } from "@playwright/test";

// galaxy-3d Validation 7: zoomed in, stars sharpen into separate points and the nearest ones are named. Reduced
// motion, so there's no twinkle or spring and each frame is the same.
const BASELINE = { peaks: 398, blown: 0.494 };
const galaxy = (page: Page) => page.locator("[data-star-count]");
const names = (page: Page) => page.getByRole("group", { name: "Projects near the middle" }).getByRole("button");
const frame = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function ready(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?layout=clouds");
  await expect(galaxy(page)).toHaveAttribute("data-classes", "ready", { timeout: 60_000 }); // 57k categories to parse
  await expect.poll(() => page.locator("canvas").evaluate((c) => "starScreen" in c), { timeout: 30_000 }).toBe(true);
}

// Into the middle of the densest cloud, about 5.8x the whole-map view.
async function zoomIntoCloud(page: Page) {
  await page.getByRole("button", { name: /^Go to Productivity & work/ }).click();
  await galaxy(page).focus();
  await page.keyboard.press("+");
  await page.keyboard.press("+");
  await page.waitForTimeout(400); // labels refresh a few times a second
  await frame(page);
}

// In a 240px box at the map's centre: how many separate bright points (local maxima), and what share of the box is
// blown out (brightest channel above half). A smear has few peaks and a big blown share.
async function sharpness(page: Page) {
  const box = (await page.locator("canvas").boundingBox())!;
  const png = await page.screenshot({ clip: { x: box.x + box.width / 2 - 120, y: box.y + box.height / 2 - 120, width: 240, height: 240 } });
  return page.evaluate(async (b64) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(img.width, img.height).getContext("2d")!;
    c.drawImage(img, 0, 0);
    const { data, width: w, height: h } = c.getImageData(0, 0, img.width, img.height);
    const lum = (x: number, y: number) => Math.max(data[4 * (y * w + x)], data[4 * (y * w + x) + 1], data[4 * (y * w + x) + 2]);
    let peaks = 0;
    let blown = 0;
    for (let y = 2; y < h - 2; y++)
      for (let x = 2; x < w - 2; x++) {
        const l = lum(x, y);
        if (l > 128) blown++;
        if (l < 70) continue;
        let top = true;
        for (let dy = -2; dy <= 2 && top; dy++)
          for (let dx = -2; dx <= 2 && top; dx++) {
            if (!dx && !dy) continue;
            const n = lum(x + dx, y + dy);
            // A flat top counts once: ties only lose to a neighbour earlier in scan order.
            if (n > l || (n === l && (dy < 0 || (dy === 0 && dx < 0)))) top = false;
          }
        if (top) peaks++;
      }
    return { peaks, blown: blown / ((w - 4) * (h - 4)) };
  }, png.toString("base64"));
}

test("zoomed into a cloud, its core is separate points, not one smear", async ({ page }, info) => {
  test.slow(); // software GL at 57k stars
  await ready(page);
  await zoomIntoCloud(page);
  const s = await sharpness(page);
  await page.screenshot({ path: info.outputPath("cloud-core.png") });
  info.annotations.push({ type: "sharpness", description: JSON.stringify(s) });
  // Before the change (main at cd9b1b7, same steps, SwiftShader): 398 peaks, 49% of the box blown out. Peaks alone
  // flatter a smear (its noise makes many tiny ones), so the bar is the blown share falling to a third, peaks not fewer.
  expect(s.blown).toBeLessThanOrEqual(BASELINE.blown / 3);
  expect(s.peaks).toBeGreaterThanOrEqual(BASELINE.peaks);
});

// Each shown name's star has no other star drawn within 16px of it (NAME_ISOLATION), so the name points at one dot.
async function expectIsolated(page: Page) {
  const indices = (await names(page).filter({ visible: true }).evaluateAll((els) => els.map((e) => Number((e as HTMLElement).dataset.index))));
  const gaps = await page.locator("canvas").evaluate((c, indices) => {
    const all = (c as unknown as { starScreen(i: number[]): { x: number; y: number }[] }).starScreen;
    const n = (c as unknown as { starPositions: ArrayLike<number> }).starPositions.length / 3;
    const pts = all(Array.from({ length: n }, (_, i) => i));
    return indices.map((i) => Math.min(...pts.map((p, j) => (j === i ? Infinity : Math.hypot(p.x - pts[i].x, p.y - pts[i].y)))));
  }, indices);
  for (const g of gaps) expect(g).toBeGreaterThanOrEqual(15.5);
}

test("the whole map names no projects; zoomed in, the nearest ones are named and a name selects its project", async ({ page }) => {
  test.slow(); // software GL at 57k stars
  await ready(page);
  await frame(page);
  await expect(names(page).filter({ visible: true })).toHaveCount(0);
  // In the cloud's core (about 5.8x) stars still crowd each other: any name shown is on a star standing apart.
  await zoomIntoCloud(page);
  await expectIsolated(page);
  // Close in (about 37x), stars separate and the nearest ones that stand apart are named.
  for (let k = 0; k < 4; k++) await page.keyboard.press("+");
  await page.waitForTimeout(600);
  await frame(page);
  await expectIsolated(page);
  const shown = names(page).filter({ visible: true });
  const count = await shown.count();
  expect(count).toBeGreaterThanOrEqual(1);
  expect(count).toBeLessThanOrEqual(10);
  const titles = new Set(((await (await page.request.get("/corpus/stars.json")).json()).stars as { title: string }[]).map((s) => s.title));
  for (const text of await shown.allTextContents()) {
    const full = text.endsWith("…") ? [...titles].some((t) => t.startsWith(text.slice(0, -1))) : titles.has(text);
    expect(full, text).toBe(true);
  }
  const first = shown.first();
  const id = await first.getAttribute("data-id");
  await first.click();
  await expect(galaxy(page)).toHaveAttribute("data-selected-id", id!);
  // Selected, the names give way to the project's own panel.
  await expect(names(page).filter({ visible: true })).toHaveCount(0);
});

