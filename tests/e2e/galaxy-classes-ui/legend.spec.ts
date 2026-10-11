import { expect, test } from "@playwright/test";

// #462: the rail legend at desktop widths. Names whole, readouts apart, every row in one type, a visible end to the
// list, and "Mixed" told apart from "Not enough text".
for (const width of [1440, 1920]) {
  test(`legend at ${width}px: whole names, separated readouts, one row style, distinct grey swatches`, async ({ page }, info) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator('[data-classes="ready"]')).toBeVisible({ timeout: 60_000 });
    const legend = page.locator('section[aria-label="Categories"]');
    await expect(legend).toBeVisible();
    const r = await legend.evaluate((el) => {
      const box = (e: Element) => e.getBoundingClientRect();
      const inner = box(el), pad = parseFloat(getComputedStyle(el).paddingRight);
      const readouts = [...el.querySelectorAll("dl > div")].map((d) => ({ dt: box(d.querySelector("dt")!), dd: box(d.querySelector("dd")!) }));
      const rows = [...el.querySelectorAll("button[data-key], button[aria-pressed]")].filter((b) => b.querySelector("span:nth-child(2)"));
      const labels = rows.map((b) => b.querySelector("span:nth-child(2)") as HTMLElement);
      const font = (e: Element) => { const s = getComputedStyle(e); return `${s.fontFamily}|${s.fontSize}|${s.textTransform}`; };
      const swatch = (key: string) => { const s = el.querySelector(`button[data-key="${key}"] span`); return s ? `${getComputedStyle(s).backgroundColor}|${getComputedStyle(s).borderStyle}|${getComputedStyle(s).borderColor}` : null; };
      const note = [...el.querySelectorAll("p")].at(-1)!;
      return {
        truncated: labels.filter((l) => l.scrollWidth > l.clientWidth + 1).map((l) => l.textContent),
        fonts: [...new Set(labels.map(font))],
        // Each label sits over its own value, and neighbouring readouts don't touch.
        stacked: readouts.every((x) => x.dt.bottom <= x.dd.top + 2 && x.dt.left < x.dd.right && x.dd.left < x.dt.right),
        gaps: readouts.slice(1).map((x, i) => (Math.abs(x.dt.top - readouts[i].dt.top) < 2 ? x.dt.left - readouts[i].dt.right : Infinity)),
        insideRight: readouts.every((x) => x.dt.right <= inner.right - pad + 0.5 && x.dd.right <= inner.right - pad + 0.5),
        mixed: swatch("mixed"), unclear: swatch("insufficient_text"),
        // Scrolled to the end, the footnote sits whole above the 24px fade; while more is below, the fade shows.
        cue: (() => { const sc = el.firstElementChild as HTMLElement; return sc.scrollHeight <= sc.clientHeight || getComputedStyle(sc).maskImage.includes("gradient"); })(),
        noteVisible: (() => { const sc = el.firstElementChild as HTMLElement; sc.scrollTop = sc.scrollHeight; const n = box(note), s = box(sc); return n.top >= s.top && n.bottom <= s.bottom - 24 + 0.5; })(),
      };
    });
    expect(r.truncated, "category names are whole").toEqual([]);
    expect(r.fonts, "prize row matches category rows").toHaveLength(1);
    expect(r.stacked, "each label over its value").toBe(true);
    expect(Math.min(...r.gaps), "readouts apart").toBeGreaterThanOrEqual(12);
    expect(r.insideRight, "readouts inside the padding").toBe(true);
    if (r.mixed && r.unclear) expect(r.mixed).not.toBe(r.unclear);
    expect(r.cue, "a scroll cue when the legend scrolls").toBe(true);
    expect(r.noteVisible, "the footnote isn't cut").toBe(true);
    // The rest of the rail keeps room: the legend stays within its old 46vh cap.
    expect((await legend.boundingBox())!.height).toBeLessThanOrEqual(900 * 0.46 + 1);
    await legend.evaluate((el) => { el.firstElementChild!.scrollTop = 0; });
    await page.screenshot({ path: info.outputPath(`legend-${width}.png`), clip: { x: 0, y: 0, width: 300, height: 900 } });
  });
}
