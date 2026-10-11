import { expect, test } from "@playwright/test";

// #472: under forced colors (Windows High Contrast) a pressed toggle still looks pressed. The page's tints and inset
// shadows are dropped there, so the pressed layout button must differ from its neighbour in the colours that remain.
test("a pressed toggle stays distinguishable under forced colors", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "By category" });
  await expect(toggle).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
  // Comparing computed strings isn't enough: forced colors turn the pressed fill into Canvas, which looks the same as
  // the unpressed button's transparent fill over Canvas. Pressed must take the system Highlight colour.
  const highlight = await page.evaluate(() => {
    const probe = document.body.appendChild(Object.assign(document.createElement("span"), { style: "forced-color-adjust: none; background: Highlight" }));
    const c = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return c;
  });
  const fill = (name: string) => page.getByRole("button", { name }).evaluate((b) => getComputedStyle(b).backgroundColor);
  expect(await fill("By category")).toBe(highlight);
  expect(await fill("By meaning")).not.toBe(highlight);
});
