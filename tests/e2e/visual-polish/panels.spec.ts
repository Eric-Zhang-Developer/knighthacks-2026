import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// A real record from the corpus fixture, which the loaded corpus contains (changes/corpus-embed.md).
const record = JSON.parse(readFileSync("corpus/fixtures/sample.jsonl", "utf8").split("\n")[0]) as { title: string };

const PANELS = ["search", "drawer", "explainer", "voice"] as const;

test.describe.configure({ timeout: 60_000 });

async function openEveryPanel(page: Page) {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search projects" }).fill(record.title);
  const similar = page.getByRole("list", { name: "Similar projects" });
  await similar.getByRole("button").first().click();
  await expect(page.getByRole("region", { name: "Project" }).getByRole("heading")).toHaveText(record.title);
  // This visual-token check intentionally keeps the search popover mounted while opening the map explainer.
  await page.getByText("What am I looking at?").click({ force: true });
  for (const p of PANELS) await expect(page.locator(`[data-panel="${p}"]`)).toBeVisible();
}

test("search, drawer, explainer and voice panels share the panel tokens", async ({ page }) => {
  await openEveryPanel(page);
  const styles = await page.evaluate((panels) => {
    // Resolve each token through the browser, so the comparison is in the same rgb()/px units as computed styles.
    const probe = document.createElement("div");
    document.body.append(probe);
    probe.style.cssText = "background: var(--panel); border: 1px solid var(--border); font-size: var(--heading)";
    const cs = getComputedStyle(probe);
    const tokens = { background: cs.backgroundColor, border: cs.borderTopColor, heading: cs.fontSize };
    probe.remove();
    const found = Object.fromEntries(
      panels.map((p) => {
        const el = document.querySelector(`[data-panel="${p}"]`)!;
        const h = el.querySelector("h2, summary");
        const s = getComputedStyle(el);
        return [p, { background: s.backgroundColor, border: s.borderTopColor, heading: h ? getComputedStyle(h).fontSize : null }];
      }),
    );
    return { tokens, found };
  }, PANELS);

  for (const p of PANELS) expect(styles.found[p], p).toEqual(styles.tokens);
  const layout = await page.evaluate(() => {
    const rect = (selector: string) => {
      const r = document.querySelector(selector)!.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width, height: r.height };
    };
    return {
      rail: rect('[aria-label="Discovery"]'),
      map: rect('main[aria-label="Galaxy"]'),
      drawer: rect('aside[aria-label="Idea and evidence"]'),
    };
  });
  expect(layout.rail.right).toBeLessThanOrEqual(layout.map.left + 1);
  expect(layout.map.right).toBeLessThanOrEqual(layout.drawer.left + 1);
  expect(layout.map.width).toBeGreaterThan(layout.rail.width);
  await page.getByRole("searchbox", { name: "Search projects" }).fill("");
  await page.screenshot({ path: test.info().outputPath("desktop.png") });
});

test("phone width evidence", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEveryPanel(page);
  const layout = await page.evaluate(() => {
    const rect = (selector: string) => {
      const r = document.querySelector(selector)!.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    return {
      rail: rect('[aria-label="Discovery"]'),
      map: rect('main[aria-label="Galaxy"]'),
      sheet: rect('aside[aria-label="Idea and evidence"]'),
      voice: rect('footer[aria-label="Voice"]'),
    };
  });
  expect(layout.rail.bottom).toBeLessThanOrEqual(layout.map.top + 1);
  expect(layout.map.height).toBeGreaterThan(500);
  expect(layout.sheet.bottom).toBeLessThanOrEqual(layout.voice.top + 1);
  expect(layout.voice.bottom).toBeLessThanOrEqual(844);
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Live AI Talk" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search projects" }).fill("");
  await page.screenshot({ path: test.info().outputPath("phone.png"), fullPage: true });
});

test("reduced motion removes the shell transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const durations = await page.evaluate(() => {
    const sheet = document.querySelector('aside[aria-label="Idea and evidence"]')!;
    const talk = document.querySelector('[data-panel="voice"] button')!;
    return [getComputedStyle(sheet).transitionDuration, getComputedStyle(talk).transitionDuration];
  });
  expect(durations).toEqual(["0s", "0s"]);
});
