import { expect, test, type Page } from "@playwright/test";

// design-refresh Validation 1-5. Gemini is stubbed for the saved idea (AI_STUB_DIR); traces would hold the cookie.
test.use({ trace: "off" });

const rgb = (s: string) => s.match(/[\d.]+/g)!.slice(0, 3).map(Number);
const lum = ([r, g, b]: number[]) => {
  const c = [r, g, b].map((v) => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
async function saveIdea(page: Page) {
  expect(process.env.AI_STUB_DIR, "Start the server with AI_STUB_DIR=tests/e2e/idea-create-ui/fixtures").toBeTruthy();
  const card = page.getByRole("region", { name: "Your idea" });
  await card.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals.");
  await card.getByRole("button", { name: "Interpret" }).click();
  await card.getByRole("button", { name: "Save" }).click({ timeout: 60_000 });
  await expect(card).toHaveAttribute("data-version-id", /.+/, { timeout: 60_000 });
}

test("desktop: full-window chart, floating glass rails, Material surfaces, readable contrast", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
  // 1. The chart (the shell's background) covers the window; the rails float over it, rounded and blurred.
  const shell = (await page.locator("main[aria-label=Galaxy]").locator("..").boundingBox())!;
  expect([shell.x, shell.y, shell.width, shell.height]).toEqual([0, 0, 1440, 900]);
  const chrome = await page.evaluate(() =>
    ["main[aria-label=Galaxy] > div:first-child", "aside[aria-label='Idea and evidence']"].map((s) => {
      const cs = getComputedStyle(document.querySelector(s)!);
      return { radius: cs.borderTopLeftRadius, blur: cs.backdropFilter };
    }),
  );
  for (const c of chrome) {
    expect(c.radius).toBe("16px");
    expect(c.blur).toContain("blur");
  }

  // 2. Panels are Material surface containers with the large corner; buttons are full pills; text pairs read.
  const s = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.background = "var(--md-sys-color-surface-container)";
    document.body.append(probe);
    const surface = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const panel = document.querySelector('[aria-label="Your idea"]')!;
    const pcs = getComputedStyle(panel);
    const heading = getComputedStyle(panel.querySelector("h2")!).color;
    const muted = getComputedStyle(document.querySelector(".shell-starters p")!).color;
    const btn = getComputedStyle(panel.querySelector("button")!).borderTopLeftRadius;
    return { surface, bg: pcs.backgroundColor, radius: pcs.borderTopLeftRadius, text: pcs.color, heading, muted, btn };
  });
  expect(s.bg).toBe(s.surface);
  expect(s.radius).toBe("16px");
  expect(s.btn).toBe("9999px");
  for (const fg of [s.text, s.heading, s.muted]) expect(contrast(fg, s.bg)).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: info.outputPath("desktop.png") });
});

test("empty start: four sparks fill the draft; after saving, the step index jumps to Test", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  // 5. Sparks.
  const sparks = page.getByRole("group", { name: "Idea starters" }).getByRole("button");
  await expect(sparks).toHaveCount(4);
  const first = await sparks.first().innerText();
  await sparks.first().click();
  await expect(page.getByRole("textbox", { name: "Describe your idea" })).toHaveValue(first);
  await expect(page.getByRole("group", { name: "Idea starters" })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Describe your idea" }).fill("");
  await expect(sparks).toHaveCount(4);

  // The step index appears once an idea exists, with the steps that have panels.
  await expect(page.getByRole("navigation", { name: "Idea steps" })).toHaveCount(0);
  await saveIdea(page);
  const steps = page.getByRole("navigation", { name: "Idea steps" });
  await expect(steps.getByRole("link", { name: "Idea" })).toBeVisible();
  await expect(steps.getByRole("link", { name: "Test" })).toBeVisible();
  await steps.getByRole("link", { name: "Test" }).click();
  await expect(steps.getByRole("link", { name: "Test" })).toHaveAttribute("aria-current", "step");
  // The rail scrolled so the Test group's top sits just under the sticky index.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const rail = document.querySelector("aside[aria-label='Idea and evidence']")!.getBoundingClientRect();
        return Math.round(document.getElementById("step-test")!.getBoundingClientRect().top - rail.top);
      }),
    )
    .toBeLessThan(80);
  await expect(page.getByRole("region", { name: "Scorecard" })).toBeInViewport();
  await page.screenshot({ path: info.outputPath("steps.png") });
});

test("reduced transparency: no blur; reduced motion: the sheet has no slide", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
  const blurred = await page.evaluate(() => [...document.querySelectorAll("*")].filter((e) => !["none", ""].includes(getComputedStyle(e).backdropFilter)).length);
  expect(blurred).toBe(0);

  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("summary", { hasText: /^Projects \(/ }).click();
  await page.getByRole("list", { name: "Projects" }).getByRole("button").first().click();
  const anim = await page.locator(".shell-sheet[data-open]").evaluate((e) => getComputedStyle(e).animationName);
  expect(anim).not.toBe("sheet-in");
});

test("phone: a quick flick up closes the project sheet; a slow short drag springs back", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
  const open = async () => {
    await page.getByRole("list", { name: "Projects" }).getByRole("button").first().click();
    await expect(page.getByRole("region", { name: "Project" })).toBeVisible();
    await page.waitForTimeout(400); // the sheet's entrance
  };
  await page.locator("summary", { hasText: /^Projects \(/ }).click();
  await open();
  await page.screenshot({ path: info.outputPath("phone-sheet.png") });
  const handle = page.getByRole("button", { name: "Drag up to close" });
  let b = (await handle.boundingBox())!;
  // Slow and short: 40px over half a second, then a pause: it stays.
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 - 40, { steps: 20 });
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.waitForTimeout(700);
  await expect(page.getByRole("region", { name: "Project" })).toBeVisible();
  expect(await page.locator(".shell-sheet").evaluate((e) => (e as HTMLElement).style.transform)).toBe("");
  // Quick: 120px in a few frames: it closes.
  b = (await handle.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 - 120, { steps: 3 });
  await page.mouse.up();
  await expect(page.getByRole("region", { name: "Project" })).toHaveCount(0, { timeout: 2000 });
  await page.screenshot({ path: info.outputPath("phone-explore.png") });
});

test("a failed panel is a calm hiccup: readable words, the glyph in the error colour, a Retry pill", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/evidence/**", (r) => r.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Evidence generation is temporarily unavailable."}' }));
  await page.goto("/");
  await saveIdea(page);
  const state = page.locator('[data-kind="failed"]').first();
  await expect(state).toBeVisible({ timeout: 30_000 });
  const s = await state.evaluate((e) => {
    const cs = getComputedStyle(e);
    const glyph = getComputedStyle(e.querySelector("span")!).color;
    const text = getComputedStyle(e.querySelector("p")!).color;
    const retry = e.querySelector("button");
    const probe = document.createElement("i");
    probe.style.color = "var(--failed)";
    document.body.append(probe);
    const failed = getComputedStyle(probe).color;
    probe.remove();
    return { bg: cs.backgroundColor, glyph, text, failed, retry: retry && getComputedStyle(retry).borderTopLeftRadius };
  });
  expect(s.glyph).toBe(s.failed);
  expect(s.text).not.toBe(s.failed);
  expect(contrast(s.text, s.bg)).toBeGreaterThanOrEqual(4.5);
  expect(s.retry).toBe("9999px");
  await state.screenshot({ path: info.outputPath("failed-state.png") });
});

// The galaxy turns in 3D (galaxy-3d), so a flat ring pattern painted behind it no longer lines up with anything.
test("no flat rings painted behind the galaxy", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  const ringed = await page.evaluate(() =>
    [...document.querySelectorAll("*")].some((e) => getComputedStyle(e).backgroundImage.includes("repeating-radial-gradient")),
  );
  expect(ringed).toBe(false);
});
