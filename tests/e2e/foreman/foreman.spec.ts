import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// The page is a snapshot of the checkout this build ran in (spec § Architecture), so it's compared with the files on
// disk and with GitHub as of the snapshot time, never with whatever GitHub says now.
const REPO = "Eric-Zhang-Developer/knighthacks-2026";
const headers: Record<string, string> = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
const specs = readdirSync("specs/features").filter((d) => !d.startsWith("_"));
const toml = readFileSync("specs/milestones.toml", "utf8");
const milestones = [...toml.matchAll(/^name = "([^"]+)"/gm)].map((m) => m[1]);
// Milestones with a ship time count down; ship = "" means order only (no clock to check).
const timed = [...toml.matchAll(/^name = "([^"]+)"[^\n]*\nship = "([^"]+)"/gm)].map((m) => m[1]);

test("milestones and graph from the checkout, asks from GitHub at the snapshot, and no GitHub call from the browser", async ({ page, request }) => {
  const github: string[] = [];
  page.on("request", (r) => r.url().includes("github.com/") && r.resourceType() !== "document" && github.push(r.url()));
  await page.goto("/foreman");
  for (const m of milestones) await expect(page.getByRole("article", { name: `Milestone ${m}` })).toBeVisible();
  expect(timed.length).toBeGreaterThan(0);
  for (const m of timed) await expect(page.getByTestId(`clock-${m}`)).toHaveText(/^\d{2}:\d{2}:\d{2}$/);

  const nodes = page.locator("svg a[data-slug]");
  await expect(nodes).toHaveCount(specs.length);
  for (const s of specs) await expect(page.locator(`svg a[data-slug="${s}"]`)).toHaveCount(1);
  await expect(page.getByTestId("step-spec")).toHaveText(String(specs.length));

  // The header names the commit this page was built from, the same one /api/health reports.
  const { commit } = (await (await request.get("/api/health")).json()) as { commit: string };
  await expect(page.locator("[data-sha]")).toHaveAttribute("data-sha", commit);
  const snapshot = Date.parse((await page.locator("[data-snapshot]").getAttribute("data-snapshot"))!);

  if (!headers.Authorization) {
    // Built without a token: the board from files, a banner, no guesses.
    await expect(page.getByTestId("api")).toHaveText("API: no token");
    await expect(page.getByTestId("degraded")).toContainText("PR data missing");
  } else {
    await expect(page.getByTestId("api")).toContainText("API: token");
    await expect(page.getByTestId("degraded")).toHaveCount(0);
    const asks = page.getByRole("list", { name: "Needs a person" });
    // Anything that changed after the snapshot may differ; everything untouched since must be listed.
    const before = (x: { updated_at: string }) => Date.parse(x.updated_at) < snapshot;
    const prs = (await (await request.get(`https://api.github.com/repos/${REPO}/pulls?state=open&per_page=100`, { headers })).json()) as {
      title: string;
      draft: boolean;
      updated_at: string;
    }[];
    for (const p of prs.filter((p) => before(p) && !p.draft && /^(plan|contract)[(:!]/.test(p.title))) await expect(asks).toContainText(p.title);
    const issues = (await (
      await request.get(`https://api.github.com/repos/${REPO}/issues?state=open&labels=needs-human&per_page=100`, { headers })
    ).json()) as { title: string; updated_at: string; pull_request?: unknown }[];
    for (const i of issues.filter((i) => before(i) && !i.pull_request)) await expect(asks).toContainText(i.title);
    await expect(page.getByTestId("intro")).toContainText(/built by \d+ agent workers in parallel, under one rulebook/);
  }

  await expect(page.locator("meta[name=robots]")).toHaveAttribute("content", /noindex/);
  await page.screenshot({ path: test.info().outputPath("foreman.png"), fullPage: true });
  expect(github).toEqual([]);
});

test("hovering a feature traces what it waits on and what waits on it", async ({ page }) => {
  await page.goto("/foreman");
  const deep = page.locator('svg a[data-slug="demo-flow"]');
  await deep.hover();
  await expect(page.locator('svg a[data-slug="bootstrap"]')).not.toHaveClass(/faded/);
  await expect(page.locator('svg a[data-slug="foreman"]')).toHaveClass(/faded/);
  await page.screenshot({ path: test.info().outputPath("foreman-trace.png") });
});

test("the replay scrubs the graph back to the first PR and returns to the snapshot", async ({ page }) => {
  test.skip(!headers.Authorization, "needs PR data: a build without GITHUB_TOKEN has no replay");
  await page.goto("/foreman");
  const info = page.getByTestId("replay-info");
  await expect(info).toContainText("SNAPSHOT");
  const counters = page.getByTestId("tour-counters");
  const built = async () => Number(/(\d+)\/\d+/.exec(await counters.innerText())![1]);
  const live = await built();
  const done = await page.locator('svg a[data-state="done"]').count();

  const slider = page.getByRole("slider", { name: "Time" });
  // The terminal's own controls, not the app's Material ones (#358): a square amber play plate, an amber scrubber.
  const play = page.getByRole("button", { name: /replay/i });
  await expect(play).toHaveCSS("border-radius", "0px");
  await expect(slider).toHaveCSS("accent-color", "rgb(255, 181, 71)");
  await slider.focus();
  await page.keyboard.press("Home");
  await expect(info).not.toContainText("SNAPSHOT");
  expect(await built()).toBeLessThan(live);
  expect(await page.locator('svg a[data-state="done"]').count()).toBeLessThan(done);
  await page.screenshot({ path: test.info().outputPath("foreman-replay-start.png") });

  await page.keyboard.press("End");
  await expect(info).toContainText("SNAPSHOT");
  await expect(page.locator('svg a[data-state="done"]')).toHaveCount(done);
});

test("the tour leads the page; space plays it with chapters and flashes and ends on the snapshot's numbers", async ({ page }) => {
  test.skip(!headers.Authorization, "needs PR data: a build without GITHUB_TOKEN has no replay");
  test.setTimeout(60_000);
  await page.goto("/foreman");
  await expect(page.locator("section").first().getByRole("heading")).toHaveText(/watch it get built/i);
  // At rest the counters are the snapshot's; the play must end on the same numbers.
  const counters = page.getByTestId("tour-counters");
  const atRest = await counters.innerText();
  await expect(page.getByTestId("tour-caption")).toContainText("press space");
  await expect(page.getByTestId("chapter").first()).toBeAttached();

  // Hydration can land after goto: retry space until the replay starts.
  await expect(async () => {
    await page.keyboard.press(" ");
    await expect(page.getByRole("button", { name: /pause/i })).toBeVisible({ timeout: 1000 });
  }).toPass();
  await expect(page.getByTestId("chapter-caption")).not.toBeEmpty({ timeout: 20_000 });
  await expect(page.locator("svg a[data-slug][class*=flash]").first()).toBeAttached({ timeout: 20_000 });
  // Motion (spec § The tour): a landing sends out a ring and draws the edges it unlocks.
  await expect(page.locator("svg rect[class*=ring]").first()).toBeAttached({ timeout: 20_000 });
  await expect(page.locator("svg path[class*=draw]").first()).toBeAttached({ timeout: 20_000 });
  await page.screenshot({ path: test.info().outputPath("foreman-tour-playing.png") });

  await expect(page.getByTestId("replay-info")).toContainText("SNAPSHOT", { timeout: 40_000 });
  await expect(counters).toHaveText(atRest, { useInnerText: true });
});

test("reduced motion: the tour still plays, but no node animates", async ({ page }) => {
  test.skip(!headers.Authorization, "needs PR data: a build without GITHUB_TOKEN has no replay");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/foreman");
  await expect(async () => {
    await page.keyboard.press(" ");
    await expect(page.getByRole("button", { name: /pause/i })).toBeVisible({ timeout: 1000 });
  }).toPass();
  const flashed = page.locator("svg a[data-slug][class*=flash]").first();
  await expect(flashed).toBeAttached({ timeout: 20_000 });
  // The playhead still moves (it is the content); nothing on the page animates or transitions while it does.
  const info = page.getByTestId("replay-info");
  const before = await info.innerText();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await expect(info).not.toHaveText(before);
});

test("demo keys: a number jumps to its section, space starts the replay", async ({ page }) => {
  test.skip(!headers.Authorization, "needs PR data: a build without GITHUB_TOKEN has no replay");
  // Instant jumps (the page honours reduced motion): this checks which key goes where, and a smooth scroll still
  // running when the next key lands made it fail under parallel load (passed 3/3 alone, failed 1 of a full run).
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/foreman");
  // The handler attaches at hydration, which can land after goto resolves: retry the first press until it does.
  await expect(async () => {
    await page.keyboard.press("5");
    await expect(page.getByRole("heading", { name: /the crew/i })).toBeInViewport({ timeout: 1000 });
  }).toPass();
  await page.keyboard.press("3");
  await expect(page.getByRole("heading", { name: /needs a person/i })).toBeInViewport();
  await page.keyboard.press(" ");
  await expect(page.getByRole("button", { name: /pause/i })).toBeVisible();
  await expect(page.getByTestId("replay-info")).not.toContainText("SNAPSHOT");
  await page.keyboard.press(" ");
  await expect(page.getByRole("button", { name: /resume/i })).toBeVisible();
});

test("since you last looked: an earlier visit shows what merged after it; a reload right away doesn't", async ({ page }) => {
  test.skip(!headers.Authorization, "needs PR data: a build without GITHUB_TOKEN has no replay");
  const before = Date.parse("2026-10-10T09:00:00-04:00"); // Sat 09:00 EDT, before many merges
  await page.addInitScript((t) => {
    if (sessionStorage.getItem("seeded")) return;
    localStorage.setItem("foreman:last-seen", String(t));
    sessionStorage.setItem("seeded", "1");
  }, before);
  await page.goto("/foreman");
  const since = page.getByRole("complementary", { name: "Since you last looked" });
  await expect(since).toContainText(/\d+ PRs merged/);
  await page.screenshot({ path: test.info().outputPath("foreman-since.png") });
  await page.reload();
  await expect(page.getByTestId("replay-info")).toBeVisible();
  await expect(since).toHaveCount(0);
});

test("clicking a feature opens its card in place; Escape closes it", async ({ page }) => {
  await page.goto("/foreman");
  // Before hydration a click would follow the link to GitHub; demo key 5 landing proves the page is live. The tour
  // is already in view at load, so key 5 (the crew, below the fold) is the proof, then key 1 comes back.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(async () => {
    await page.keyboard.press("5");
    await expect(page.getByRole("heading", { name: /the crew/i })).toBeInViewport({ timeout: 1000 });
  }).toPass();
  await page.keyboard.press("1");
  await expect(page.getByRole("heading", { name: /watch it get built/i })).toBeInViewport();
  await page.locator('svg a[data-slug="galaxy"]').click();
  const card = page.getByRole("region", { name: "Feature galaxy" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("waits on");
  await expect(card.getByRole("link", { name: /spec/ })).toHaveAttribute("href", /\/specs\/(features|shipped\/[^/]+)\/galaxy$/);
  await page.screenshot({ path: test.info().outputPath("foreman-card.png") });
  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);
});

test("charts: hovering the build-up and a timeline bar shows their tooltips; both have a table view", async ({ page }) => {
  test.skip(!headers.Authorization, "needs PR data: a build without GITHUB_TOKEN draws no charts");
  await page.goto("/foreman");
  const build = page.getByRole("figure", { name: /features built over time/i });
  const svg = build.locator("svg");
  await svg.scrollIntoViewIfNeeded();
  // Hydration attaches the hover handler; retry the move until the tooltip answers.
  await expect(async () => {
    const box = (await svg.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.6);
    await expect(page.getByTestId("buildup-tip")).toBeVisible({ timeout: 1000 });
  }).toPass();
  await expect(page.getByTestId("buildup-tip")).toContainText(/\d+ built/);
  await build.screenshot({ path: test.info().outputPath("foreman-buildup.png") });

  const crew = page.getByRole("figure", { name: /every pr by worker/i });
  // A bar mid-chart, not the first: the top row sits under the sticky header once scrolled to. No force, so
  // Playwright checks the bar really receives the pointer.
  const bars = crew.locator("svg a rect:first-child");
  const bar = bars.nth(Math.floor((await bars.count()) / 2));
  await bar.scrollIntoViewIfNeeded();
  await bar.hover();
  await expect(page.getByTestId("timeline-tip")).toContainText(/#\d+/);
  await crew.screenshot({ path: test.info().outputPath("foreman-timeline.png") });

  for (const fig of [build, crew]) {
    await fig.getByText("table", { exact: true }).click();
    await expect(fig.locator("table tbody tr").first()).toBeVisible();
  }
});
