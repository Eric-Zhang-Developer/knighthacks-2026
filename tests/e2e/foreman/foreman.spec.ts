import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Live check: the page reads GitHub at request time, so this compares it with GitHub and the checkout directly.
const REPO = "Eric-Zhang-Developer/knighthacks-2026";
const headers: Record<string, string> = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
const specs = readdirSync("specs/features").filter((d) => !d.startsWith("_"));
const milestones = [...readFileSync("specs/milestones.toml", "utf8").matchAll(/^name = "([^"]+)"/gm)].map((m) => m[1]);

test("milestones, one graph node per spec, and every human ask from GitHub", async ({ page, request }) => {
  await page.goto("/foreman");
  for (const m of milestones) await expect(page.getByRole("article", { name: `Milestone ${m}` })).toBeVisible();
  await expect(page.getByTestId(`clock-${milestones[0]}`)).toHaveText(/^\d{2}:\d{2}:\d{2}$/);

  const nodes = page.locator("svg a[data-slug]");
  await expect(nodes).toHaveCount(specs.length);
  for (const s of specs) await expect(page.locator(`svg a[data-slug="${s}"]`)).toHaveCount(1);

  const asks = page.getByRole("list", { name: "Needs a person" });
  const prs = (await (await request.get(`https://api.github.com/repos/${REPO}/pulls?state=open&per_page=100`, { headers })).json()) as {
    title: string;
    draft: boolean;
  }[];
  for (const p of prs.filter((p) => !p.draft && /^(plan|contract)[(:!]/.test(p.title))) await expect(asks).toContainText(p.title);
  const issues = (await (
    await request.get(`https://api.github.com/repos/${REPO}/issues?state=open&labels=needs-human&per_page=100`, { headers })
  ).json()) as { title: string; pull_request?: unknown }[];
  for (const i of issues.filter((i) => !i.pull_request)) await expect(asks).toContainText(i.title);

  await expect(page.locator("meta[name=robots]")).toHaveAttribute("content", /noindex/);
  await page.screenshot({ path: test.info().outputPath("foreman.png"), fullPage: true });
});

test("hovering a feature traces what it waits on and what waits on it", async ({ page }) => {
  await page.goto("/foreman");
  const deep = page.locator('svg a[data-slug="demo-flow"]');
  await deep.hover();
  await expect(page.locator('svg a[data-slug="bootstrap"]')).not.toHaveClass(/faded/);
  await expect(page.locator('svg a[data-slug="foreman"]')).toHaveClass(/faded/);
  await page.screenshot({ path: test.info().outputPath("foreman-trace.png") });
});

test("the replay scrubs the graph back to the first PR and returns to live", async ({ page }) => {
  await page.goto("/foreman");
  const info = page.getByTestId("replay-info");
  await expect(info).toContainText("LIVE");
  const built = async () => Number(/(\d+)\/\d+ built/.exec(await info.innerText())![1]);
  const live = await built();
  const done = await page.locator('svg a[data-state="done"]').count();

  const slider = page.getByRole("slider", { name: "Time" });
  await slider.focus();
  await page.keyboard.press("Home");
  await expect(info).not.toContainText("LIVE");
  expect(await built()).toBeLessThan(live);
  expect(await page.locator('svg a[data-state="done"]').count()).toBeLessThan(done);
  await page.screenshot({ path: test.info().outputPath("foreman-replay-start.png") });

  await page.keyboard.press("End");
  await expect(info).toContainText("LIVE");
  await expect(page.locator('svg a[data-state="done"]')).toHaveCount(done);
});
