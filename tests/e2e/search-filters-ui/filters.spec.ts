import { readFileSync } from "node:fs";
import { expect, test, type Page, type Response } from "@playwright/test";

// Real search API on the Neon test branch (meaning search embeds the query live, like tests/e2e/search). Highlighted
// stars are set from the same response ids as the list, so each filtered response is checked alongside the list.
type Hit = { id: string; title: string; event: string | null; year: number | null };
type Body = { results: Hit[]; textMatches: Hit[] };
const query = (JSON.parse(readFileSync("corpus/fixtures/sample.jsonl", "utf8").split("\n")[0]) as { title: string }).title;
const searchbox = (page: Page) => page.getByRole("searchbox", { name: "Search projects" });
const items = (page: Page) => page.getByRole("region", { name: "Search results" }).or(page.locator('[data-panel="search"]')).getByRole("listitem");
const searched = (page: Page, has: (u: URL) => boolean) =>
  page.waitForResponse((r: Response) => { const u = new URL(r.url()); return u.pathname === "/api/search" && has(u); }, { timeout: 30_000 });
const hits = (b: Body) => [...b.results, ...b.textMatches];

test("event and year filters narrow the results, keep the query, and clear back to the unfiltered list", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  const event = page.getByRole("combobox", { name: "Event" });
  const year = page.getByRole("combobox", { name: "Created year" });
  await expect(event).toBeVisible({ timeout: 30_000 });

  const first = searched(page, (u) => !u.searchParams.has("event") && !u.searchParams.has("year"));
  await searchbox(page).fill(query);
  const unfiltered = (await (await first).json()) as Body;
  await expect(items(page).first()).toBeVisible();
  const before = await items(page).allTextContents();
  const target = hits(unfiltered).find((h) => h.event && h.year)!;
  expect(target, "an unfiltered result with an event and a year").toBeTruthy();

  // Keyboard: the filters follow the search box in tab order.
  await searchbox(page).focus();
  await page.keyboard.press("Tab");
  await expect(event).toBeFocused();

  // 1. Pick an event: every result (and so every highlighted star) is from it; the query is kept.
  const byEvent = searched(page, (u) => u.searchParams.get("event") === target.event && u.searchParams.get("q") === query);
  await event.selectOption(target.event!);
  const eventBody = (await (await byEvent).json()) as Body;
  expect(hits(eventBody).length).toBeGreaterThan(0);
  // A hit's `event` is only its first; membership is the server's filter, so the list labels carry the check.
  await expect(searchbox(page)).toHaveValue(query);
  await expect(items(page)).toHaveCount(new Set(hits(eventBody).map((h) => h.id)).size);
  for (const t of await items(page).allTextContents()) expect(t).toContain(target.event!);

  // 2. Pick a year: every result shows "created <year>".
  const byYear = searched(page, (u) => u.searchParams.get("year") === String(target.year));
  await year.selectOption(String(target.year));
  const yearBody = (await (await byYear).json()) as Body;
  expect(hits(yearBody).every((h) => h.year === target.year)).toBe(true);
  for (const t of await items(page).allTextContents()) expect(t).toContain(`created ${target.year}`);

  // 3. Clear both: the unfiltered results return.
  await event.selectOption("");
  const cleared = searched(page, (u) => !u.searchParams.has("event") && !u.searchParams.has("year"));
  await year.selectOption("");
  await cleared;
  await expect.poll(() => items(page).allTextContents()).toEqual(before);

  // An empty query with a filter lists that filter's projects from stars.json, with no search request.
  let requests = 0;
  page.on("request", (r) => { if (new URL(r.url()).pathname === "/api/search") requests++; });
  await searchbox(page).fill("");
  await event.selectOption(target.event!);
  const projects = page.getByRole("list", { name: "Projects" }).getByRole("listitem");
  await expect(projects.first()).toBeVisible();
  for (const t of await projects.allTextContents()) expect(t).toContain(target.event!);
  await page.waitForTimeout(800);
  expect(requests).toBe(0);
  await page.screenshot({ path: test.info().outputPath("filters.png") });
});
