import { expect, test } from "@playwright/test";

// #352: at the fit zoom on a phone, no two region labels overlap; a label that would overlap a nearer one hides (the
// legend still names it). The galaxy drifts, so the boxes are sampled over a few seconds, not once.
type Canvas = HTMLCanvasElement & { starView: { moving: boolean }; starMorph: { t: number } };
test("phone: visible region labels never overlap at the fit zoom", async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator('[data-classes="ready"]')).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => page.locator("canvas").evaluate((c) => "starMorph" in c && (c as Canvas).starMorph.t === 1 && !(c as Canvas).starView.moving), { timeout: 30_000 }).toBe(true);
  let shown = 0;
  for (let k = 0; k < 10; k++) {
    const boxes = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("[class*='region'] > button")]
        .filter((b) => { const s = getComputedStyle(b.parentElement!); return s.visibility === "visible" && parseFloat(s.opacity) > 0.01; })
        .map((b) => { const r = b.getBoundingClientRect(); return { label: b.textContent!.trim(), x0: r.left, x1: r.right, y0: r.top, y1: r.bottom }; }),
    );
    shown = Math.max(shown, boxes.length);
    const clashes = boxes.flatMap((a, i) => boxes.slice(i + 1).filter((b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0).map((b) => `${a.label} / ${b.label}`));
    expect(clashes, `sample ${k}`).toEqual([]);
    await page.waitForTimeout(250);
  }
  expect(shown, "some labels are shown at all").toBeGreaterThan(2);
  await page.screenshot({ path: info.outputPath("phone-labels.png") });
});
