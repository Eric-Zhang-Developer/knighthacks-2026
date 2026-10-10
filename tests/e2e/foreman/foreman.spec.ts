import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Live check: the page reads GitHub at request time, so this compares it with GitHub and the checkout directly.
const REPO = "Eric-Zhang-Developer/knighthacks-2026";
const headers: Record<string, string> = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};

// Compare with the exact commit the page rendered (it shows it in data-sha): main moves while tests run, and a spec
// merged between the page load and a local checkout would otherwise fail a correct page.
async function atRenderedSha(page: Page, request: APIRequestContext) {
  const sha = await page.locator("[data-sha]").getAttribute("data-sha");
  const tree = (await (await request.get(`https://api.github.com/repos/${REPO}/git/trees/${sha}?recursive=1`, { headers })).json()) as {
    tree: { path: string }[];
  };
  const specs = tree.tree
    .map((t) => /^specs\/(?:features|shipped\/[^/]+)\/([^/_][^/]*)\/spec\.md$/.exec(t.path)?.[1])
    .filter((s): s is string => Boolean(s));
  const toml = await (await request.get(`https://raw.githubusercontent.com/${REPO}/${sha}/specs/milestones.toml`)).text();
  return { specs, milestones: [...toml.matchAll(/^name = "([^"]+)"/gm)].map((m) => m[1]) };
}

test("milestones, one graph node per spec, and every human ask from GitHub", async ({ page, request }) => {
  await page.goto("/foreman");
  const { specs, milestones } = await atRenderedSha(page, request);
  expect(specs.length).toBeGreaterThan(0);
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

  // The pipeline's Spec step counts the same specs the graph draws.
  await expect(page.getByTestId("step-spec")).toHaveText(String(specs.length));

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

test("demo keys: a number jumps to its section, space starts the replay", async ({ page }) => {
  await page.goto("/foreman");
  // The handler attaches at hydration, which can land after goto resolves: retry the first press until it does.
  await expect(async () => {
    await page.keyboard.press("5");
    await expect(page.getByRole("heading", { name: /the crew/i })).toBeInViewport({ timeout: 1000 });
  }).toPass();
  await page.keyboard.press("2");
  await expect(page.getByRole("heading", { name: /needs a person/i })).toBeInViewport();
  await page.keyboard.press(" ");
  await expect(page.getByRole("button", { name: /pause/i })).toBeVisible();
  await expect(page.getByTestId("replay-info")).not.toContainText("LIVE");
  await page.keyboard.press(" ");
  await expect(page.getByRole("button", { name: /resume/i })).toBeVisible();
});

test("since you last looked: an earlier visit shows what merged after it; a reload right away doesn't", async ({ page }) => {
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
  // Before hydration a click would follow the link to GitHub; demo key 4 landing proves the page is live.
  await expect(async () => {
    await page.keyboard.press("4");
    await expect(page.getByRole("heading", { name: /the site plan/i })).toBeInViewport({ timeout: 1000 });
  }).toPass();
  await page.locator('svg a[data-slug="galaxy"]').click();
  const card = page.getByRole("region", { name: "Feature galaxy" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("waits on");
  await expect(card.getByRole("link", { name: /spec/ })).toHaveAttribute("href", /\/specs\/(features|shipped\/[^/]+)\/galaxy$/);
  await page.screenshot({ path: test.info().outputPath("foreman-card.png") });
  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);
});
