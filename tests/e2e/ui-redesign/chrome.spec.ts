import { expect, test } from "@playwright/test";

// ui-redesign Validation 2: at desktop and phone widths no visible text is cut off mid-glyph and the legend has no
// scrollbar across. An ellipsis is a deliberate truncation (the full name stays the accessible name); a hard clip is not.
for (const [name, viewport] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]] as const) {
  test(`${name}: no clipped text, no sideways scroll in the legend`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("region", { name: "Categories" }).getByRole("button").first()).toBeVisible();
    const found = await page.evaluate(() => {
      const clipped = [...document.querySelectorAll("body *")].filter((e) => {
        const r = e.getBoundingClientRect();
        if (r.width <= 1 || r.height <= 1) return false; // visually hidden labels
        const cs = getComputedStyle(e);
        if (cs.visibility === "hidden" || cs.overflowX === "visible" || cs.textOverflow === "ellipsis") return false;
        const text = [...e.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
        return text && e.scrollWidth > e.clientWidth + 1;
      });
      const legend = document.querySelector(`[aria-label="Categories"]`)!;
      return { clipped: clipped.map((e) => e.textContent!.trim().slice(0, 40)), sideways: legend.scrollWidth > legend.clientWidth + 1 };
    });
    expect(found.clipped).toEqual([]);
    expect(found.sideways).toBe(false);
    await page.screenshot({ path: info.outputPath(`${name}.png`) });
  });
}
