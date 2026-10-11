import { expect, test, type Page } from "@playwright/test";

// galaxy-3d Validation 8: "Hide category colors" turns the stars plain, and "By meaning" names no categories (each
// spans the whole map there, so its label would sit in the middle). Reduced motion, so each frame is the same.
const galaxy = (page: Page) => page.locator("[data-star-count]");
const toggle = (page: Page) => page.getByRole("button", { name: "Hide category colors" });
const labels = (page: Page) => page.getByRole("button", { name: /^Go to / });

// Of the lit pixels in a 320px box at the map's centre, the share whose hue is outside the plain stars' blue-white
// (hue 190-250 degrees, or barely saturated).
async function colourful(page: Page) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const box = (await page.locator("canvas").boundingBox())!;
  const png = await page.screenshot({ clip: { x: box.x + box.width / 2 - 160, y: box.y + box.height / 2 - 160, width: 320, height: 320 } });
  return page.evaluate(async (b64) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(img.width, img.height).getContext("2d")!;
    c.drawImage(img, 0, 0);
    const d = c.getImageData(0, 0, img.width, img.height).data;
    let lit = 0;
    let off = 0;
    for (let p = 0; p < d.length; p += 4) {
      const [r, g, b] = [d[p], d[p + 1], d[p + 2]];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max < 60) continue;
      lit++;
      if ((max - min) / max < 0.12) continue;
      const h = max === r ? (60 * (g - b)) / (max - min) : max === g ? 120 + (60 * (b - r)) / (max - min) : 240 + (60 * (r - g)) / (max - min);
      const hue = (h + 360) % 360;
      if (hue < 190 || hue > 250) off++;
    }
    return lit ? off / lit : 0;
  }, png.toString("base64"));
}

test("hide category colors makes the stars plain, is kept in the URL, and By meaning shows no category labels", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?layout=clouds");
  await expect(galaxy(page)).toHaveAttribute("data-classes", "ready");
  await expect(labels(page).first()).toBeVisible();

  await page.getByRole("button", { name: "By meaning" }).click();
  await expect(galaxy(page)).toHaveAttribute("data-layout", "nebula");
  await expect(labels(page)).toHaveCount(0);
  await page.waitForTimeout(1500); // the layout morph
  const before = await colourful(page);

  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  await expect(galaxy(page)).toHaveAttribute("data-plain", "true");
  expect(new URL(page.url()).searchParams.get("colors")).toBe("off");
  const after = await colourful(page);
  info.annotations.push({ type: "colourful share", description: `before ${before.toFixed(3)}, after ${after.toFixed(3)}` });
  await page.screenshot({ path: info.outputPath("plain.png") });
  expect(before).toBeGreaterThan(0.3);
  expect(after).toBeLessThan(0.05);

  await page.reload();
  await expect(galaxy(page)).toHaveAttribute("data-classes", "ready");
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  await toggle(page).click();
  await expect(galaxy(page)).toHaveAttribute("data-plain", "false");
  expect(new URL(page.url()).searchParams.has("colors")).toBe(false);
});
