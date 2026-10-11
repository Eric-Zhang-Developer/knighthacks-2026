import { expect, test, type Page } from "@playwright/test";

// Layout checks for the shell (specs/features/experience-shell, Validation 1-4). Screenshots are evidence only.
// Gemini is stubbed for the saved idea (AI_STUB_DIR); traces would hold the session cookie.
test.use({ trace: "off" });
const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!;
const near = (actual: number, expected: number) => expect(Math.abs(actual - expected), `${actual} vs ${expected}`).toBeLessThanOrEqual(1);
const RAIL = "main[aria-label=Galaxy] > div:first-child";

// The rails float 12px in from the edges over a full-window chart (design-refresh Validation 1 supersedes "the galaxy
// filling the centre"): the canvas sits between them, under the top bar, and push-to-talk floats over its bottom.
const GAP = 12;
test("desktop: top bar, rails and composer at their sizes, the galaxy between the rails", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
  // The canvas starts at the browser's default 300px and is sized from a ResizeObserver after first render, so
  // measure once it fills the box react-three-fiber gives it (#377: "300 vs 808" in 1 of 3 runs on main).
  await expect
    .poll(() => page.locator("canvas").evaluate((c) => c.getBoundingClientRect().width === c.parentElement!.getBoundingClientRect().width), { timeout: 10_000 })
    .toBe(true);
  const top = await box(page, "div:has(> header[aria-label=Search])");
  const rail = await box(page, RAIL);
  const side = await box(page, "aside[aria-label='Idea and evidence']");
  const composer = await box(page, "footer[aria-label=Voice]");
  const canvas = await box(page, "canvas");
  near(top.height, 52);
  near(rail.width, 224);
  near(side.width, 360);
  near(composer.height, 72);
  near(rail.x, GAP);
  near(side.x + side.width, 1440 - GAP);
  // The galaxy takes everything between the rails, from the top bar to the bottom; the composer floats over it.
  near(canvas.x, 224 + 2 * GAP);
  near(canvas.y, 52);
  near(canvas.width, 1440 - 224 - 360 - 4 * GAP);
  near(canvas.height, 900 - 52);
  near(composer.x, canvas.x);
  near(composer.width, canvas.width);
  near(composer.y + composer.height, 900);
  // History and the project list sit in the left rail.
  const inRail = page.locator(RAIL);
  await expect(inRail.getByRole("slider")).toBeVisible();
  await expect(inRail.locator("summary", { hasText: /^Projects \(/ })).toBeVisible();
  await expect(inRail.getByText("What am I looking at?")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Destinations" })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: info.outputPath("desktop.png") });
});

test("phone: one destination per screen (five with Plan), 44px navigation, and Back closes a project", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
  const nav = page.getByRole("navigation", { name: "Destinations" });
  const shows: Record<string, (p: Page) => ReturnType<Page["locator"]>> = {
    Explore: (p) => p.locator("canvas"),
    Talk: (p) => p.getByRole("button", { name: "Hold to talk" }),
    Idea: (p) => p.getByRole("region", { name: "Your idea" }),
    Decide: (p) => p.getByText("Save an idea to vote on it, decide, and share it."),
    Plan: (p) => p.getByText("Save an idea, then plan its build here."),
  };
  for (const [name, shown] of Object.entries(shows)) {
    const link = nav.getByRole("link", { name });
    await link.click();
    await expect(link).toHaveAttribute("aria-current", "page");
    await expect(page).toHaveURL(new RegExp(`#${name.toLowerCase()}$`));
    await expect(shown(page)).toBeVisible();
    const b = (await link.boundingBox())!;
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
    // Exactly one destination: the others' content is hidden, and nothing scrolls past the screen or sideways. On
    // purpose, Talk includes the Idea card and Explore includes push-to-talk.
    const shared = new Set(["Talk>Idea", "Explore>Talk"]);
    for (const [other, hidden] of Object.entries(shows)) if (other !== name && !shared.has(`${name}>${other}`)) await expect(hidden(page)).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: info.outputPath(`phone-${name.toLowerCase()}.png`) });
  }

  // Open a project from Explore's list; Back closes it and Explore stays.
  await nav.getByRole("link", { name: "Explore" }).click();
  await page.locator("summary", { hasText: /^Projects \(/ }).click();
  await page.getByRole("list", { name: "Projects" }).getByRole("button").first().click();
  const project = page.getByRole("region", { name: "Project" });
  await expect(project).toBeVisible();
  await page.screenshot({ path: info.outputPath("phone-project.png") });
  await page.goBack();
  await expect(project).toHaveCount(0);
  await expect(page).toHaveURL(/#explore$/);
  await expect(page.locator("canvas")).toBeVisible();
});

test("keyboard: Tab reaches search, the project list, the composer and the rails in order, with a focus ring", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
  const want = ["Search projects", "Projects (", "Hold to talk", "Describe your idea"];
  const seen: number[] = [];
  for (let i = 0; i < 80 && seen.length < want.length; i++) {
    await page.keyboard.press("Tab");
    const name = await page.evaluate(() => {
      const e = document.activeElement as HTMLElement;
      return e.getAttribute("aria-label") ?? e.textContent ?? "";
    });
    if (name.startsWith(want[seen.length])) {
      const ring = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
      expect(ring, `focus ring on ${name}`).not.toBe("none");
      seen.push(i);
    }
  }
  expect(seen, "reached in order: " + want.join(" → ")).toHaveLength(want.length);
});

test("mic denied: the composer says so, and a typed idea still interprets and saves", async ({ page }) => {
  expect(process.env.AI_STUB_DIR, "Start the server with AI_STUB_DIR=tests/e2e/idea-create-ui/fixtures").toBeTruthy();
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const composer = page.locator("footer[aria-label=Voice]");
  await composer.getByRole("button", { name: "Hold to talk" }).focus();
  await page.keyboard.down(" ");
  await expect(composer.getByRole("alert")).toHaveText(/Microphone blocked/);
  await page.keyboard.up(" ");
  const card = page.getByRole("region", { name: "Your idea" });
  await card.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals.");
  await card.getByRole("button", { name: "Interpret" }).click();
  await card.getByRole("button", { name: "Save" }).click({ timeout: 60_000 });
  await expect(card).toHaveAttribute("data-version-id", /.+/, { timeout: 60_000 });
  // The mounted step panels (Plan 6-7): the scorecard in the idea path, then the plan after Decide.
  await expect(page.getByRole("region", { name: "Scorecard" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Plan" })).toBeVisible();
});
