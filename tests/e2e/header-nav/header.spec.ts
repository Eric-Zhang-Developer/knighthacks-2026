import { expect, test } from "@playwright/test";

// specs/features/header-nav, Validation 2: the header is navigation only; search and its filters live in the dock under
// the map; Build gives the idea path the stage and survives a reload; switching keeps the typed draft.
test("desktop: a navigation-only header, search in the dock, filters behind one button, Explore / Build", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });

  // 1. The header: the wordmark and the two views, and no search box or select.
  const header = page.locator("header:has(nav[aria-label=Views])");
  await expect(header.getByText("Uncharted", { exact: true })).toBeVisible();
  const views = header.getByRole("navigation", { name: "Views" });
  await expect(views.getByRole("link", { name: "Explore" })).toHaveAttribute("aria-current", "page");
  await expect(views.getByRole("link", { name: "Build" })).toBeVisible();
  await expect(header.getByRole("searchbox")).toHaveCount(0);
  await expect(header.getByRole("combobox")).toHaveCount(0);

  // 2. Search sits in the dock at the bottom of the map, beside push-to-talk.
  const search = page.getByRole("searchbox", { name: "Search projects" });
  const canvas = (await page.locator("canvas").boundingBox())!;
  const box = (await search.boundingBox())!;
  expect(box.y).toBeGreaterThan(canvas.y + canvas.height - 100);
  expect(box.x).toBeGreaterThanOrEqual(canvas.x);
  expect(box.x + box.width).toBeLessThanOrEqual(canvas.x + canvas.width);

  // 3. Filters: closed by default; opening shows the four fields; setting one shows a count; Clear and Escape work.
  const toggle = page.getByRole("button", { name: /^Filters/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("combobox", { name: "Event" })).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  for (const name of ["Event", "Created year"]) await expect(page.getByRole("combobox", { name })).toBeVisible();
  await page.getByRole("combobox", { name: "Event" }).selectOption({ index: 1 });
  await expect(toggle).toContainText("1");
  await page.screenshot({ path: info.outputPath("filters.png") });
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(toggle).toHaveText("Filters");
  // Closed with a filter set: it shows as a chip over the bar, and its × clears just that filter.
  await page.getByRole("combobox", { name: "Event" }).selectOption({ index: 1 });
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  const chip = page.getByRole("list", { name: "Active filters" }).getByRole("button");
  await expect(chip).toHaveCount(1);
  await chip.click();
  await expect(chip).toHaveCount(0);
  await expect(toggle).toHaveText("Filters");

  // 4. Build: the discovery rail and dock give way to the idea path in a wide column; #build survives a reload.
  const draft = "A tool that helps roommates split chores fairly";
  await page.getByRole("textbox", { name: "Describe your idea" }).fill(draft);
  await views.getByRole("link", { name: "Build" }).click();
  await expect(page).toHaveURL(/#build$/);
  await expect(views.getByRole("link", { name: "Build" })).toHaveAttribute("aria-current", "page");
  await expect(search).toBeHidden();
  await expect(page.locator("main[aria-label=Galaxy] > div:first-child")).toBeHidden();
  const side = (await page.locator("aside[aria-label='Idea and evidence']").boundingBox())!;
  expect(side.width).toBeGreaterThan(600);
  near(side.x + side.width / 2, 720);
  await page.screenshot({ path: info.outputPath("build.png") });

  // 5. Explore brings the map back with the draft intact.
  await views.getByRole("link", { name: "Explore" }).click();
  await expect(search).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Describe your idea" })).toHaveValue(draft);
  await page.screenshot({ path: info.outputPath("explore.png") });

  await page.goto("/#build");
  await expect(views.getByRole("link", { name: "Build" })).toHaveAttribute("aria-current", "page");
  await expect(search).toBeHidden();
});

const near = (actual: number, expected: number) => expect(Math.abs(actual - expected), `${actual} vs ${expected}`).toBeLessThanOrEqual(2);
