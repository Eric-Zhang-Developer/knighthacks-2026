import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// The idea scan and intro (specs/features/idea-scan, Validation 2-6) on the committed corpus. The workspace, the saved
// idea and /api/scan are routed: the stored neighbours are five real stars.json projects that sit together, and the
// similarities are fixture values, so the check is that the page shows exactly what the API returned, in order.
// The API's own maths is pinned in tests/idea-scan/route.test.ts.
type Star = { id: string; title: string; x: number; y: number; z: number };
const stars: Star[] = JSON.parse(readFileSync("public/corpus/stars.json", "utf8")).stars;
const seed = stars[1234];
const near = [...stars].sort((a, b) => dist(a, seed) - dist(b, seed)).slice(0, 5);
function dist(a: Star, b: Star) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
const VERSION = "8f0a6f8e-2d39-4c51-9a55-6a1c2b7d9e10";
const SIMS = [0.83, 0.79, 0.76, 0.74, 0.71];
const version = {
  ideaId: "1c9a0d4e-7f2b-4e8a-b1c3-5d6e7f8a9b0c",
  versionId: VERSION,
  parentId: null,
  title: "Shared meal planner for hackathon teams",
  description: "Teammates plan and split meals during a hackathon.",
  audience: null,
  problem: null,
  workflow: null,
  constraints: null,
  x: near.reduce((s, p) => s + p.x, 0) / 5,
  y: near.reduce((s, p) => s + p.y, 0) / 5,
  z: near.reduce((s, p) => s + p.z, 0) / 5,
  neighborIds: near.map((p) => p.id),
  corpusVersion: "fixture",
  createdAt: "2026-10-11T08:00:00.000Z",
};
const scanBody = { versionId: VERSION, searched: stars.length, neighbors: near.map((p, k) => ({ id: p.id, title: p.title, url: `https://devpost.com/software/${p.id}`, similarity: SIMS[k] })) };

async function withIdea(page: Page, scan: "ok" | "fail" = "ok") {
  await page.route("**/api/workspace", (r) =>
    r.request().method() === "POST" ? r.fulfill({ json: { workspaceId: "0b6f5c1e-1111-4a2b-8c3d-000000000001", memberId: "0b6f5c1e-2222-4a2b-8c3d-000000000002" } }) : r.fallback(),
  );
  await page.route("**/api/ideas", (r) => (r.request().method() === "GET" ? r.fulfill({ json: [version] }) : r.fallback()));
  await page.route(`**/api/scan/${VERSION}`, (r) => (scan === "ok" ? r.fulfill({ json: scanBody }) : r.fulfill({ status: 500, json: { error: "down" } })));
}
const galaxy = (page: Page) => page.locator("[data-star-count]");
const tags = (page: Page) => page.getByRole("group", { name: "Nearest projects to your idea" }).locator("button[data-on]");
const readout = (page: Page) => page.getByRole("region", { name: "Scan" });
const short = (t: string) => (t.length > 28 ? `${t.slice(0, 27).trimEnd()}…` : t);

test("a saved idea is scanned: arcs land closest first, each tag shows the API's similarity, the ledger adds up", async ({ page }, info) => {
  await withIdea(page);
  // Software GL draws a few frames a second, so record every phase the galaxy passes through rather than polling.
  await page.addInitScript(() => {
    const w = window as unknown as { scanPhases: string[] };
    w.scanPhases = [];
    new MutationObserver(() => {
      const v = document.querySelector("[data-star-count]")?.getAttribute("data-scan");
      if (v && w.scanPhases.at(-1) !== v) w.scanPhases.push(v);
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-scan"] });
  });
  await page.goto("/");
  await expect(galaxy(page)).toHaveAttribute("data-scan", /drain|reach/, { timeout: 20_000 });
  await page.screenshot({ path: info.outputPath("1-scanning.png") });
  await expect(galaxy(page)).toHaveAttribute("data-scan", "done", { timeout: 15_000 });
  const phases = (await page.evaluate(() => (window as unknown as { scanPhases: string[] }).scanPhases)).filter((p) => p !== "idle");
  expect(phases[0]).toBe("drain"); // in order: drain, reach (a slow frame may skip the short settle), done
  expect(phases.indexOf("reach")).toBe(1);
  expect(phases.at(-1)).toBe("done");
  await expect(tags(page)).toHaveCount(5);
  // Every tag and log line shows exactly what the API returned, closest first.
  const texts = (await tags(page).allInnerTexts()).map((t) => t.replace(/\s+/g, " "));
  expect(texts).toEqual(near.map((p, k) => `${SIMS[k].toFixed(2)} ${short(p.title)}`));
  const log = (await readout(page).getByRole("listitem").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
  expect(log).toEqual(near.map((p, k) => `LINK ${SIMS[k].toFixed(2)} ${p.title}`));
  await expect(readout(page)).toContainText(`${stars.length.toLocaleString("en-US")} projects searched · 5 nearest linked · closest 0.83 · 0 invented`);
  // Settled into the idea focus: neighbours lit, everything else dimmed.
  await expect(galaxy(page)).toHaveAttribute("data-dimmed-count", String(stars.length - 5));
  await page.screenshot({ path: info.outputPath("3-done.png") });

  // A log line selects its project.
  await readout(page).getByRole("button", { name: `Select ${near[2].title}` }).click();
  await expect(galaxy(page)).toHaveAttribute("data-selected-id", near[2].id);
});

test("any input ends the scan at once; Replay plays it again", async ({ page }) => {
  await withIdea(page);
  await page.goto("/");
  await expect(galaxy(page)).toHaveAttribute("data-scan", "drain", { timeout: 20_000 });
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 10);
  await page.mouse.up();
  await expect(galaxy(page)).toHaveAttribute("data-scan", "done", { timeout: 1_000 });
  await expect(tags(page)).toHaveCount(5);
  await readout(page).getByRole("button", { name: "Replay the scan" }).click();
  await expect(galaxy(page)).toHaveAttribute("data-scan", /drain|reach/);
  await expect(galaxy(page)).toHaveAttribute("data-scan", "done", { timeout: 8_000 });
});

test("reduced motion shows the settled scan on the first frame", async ({ browser }) => {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  await withIdea(page);
  await page.goto("/");
  await expect(galaxy(page)).toHaveAttribute("data-scan", "done", { timeout: 20_000 });
  await expect(tags(page)).toHaveCount(5);
  await page.close();
});

test("the intro lights every category in turn, only when asked", async ({ page }, info) => {
  await page.goto("/?intro");
  await expect(galaxy(page)).toHaveAttribute("data-intro", "play", { timeout: 20_000 });
  const survey = page.getByRole("region", { name: "Survey" });
  await expect(survey).toContainText(`${stars.length.toLocaleString("en-US")} projects`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: info.outputPath("intro-mid.png") });
  await expect(galaxy(page)).toHaveAttribute("data-intro", "done", { timeout: 12_000 });
  await page.screenshot({ path: info.outputPath("intro-done.png") });
  await page.goto("/");
  await expect(galaxy(page)).toHaveAttribute("data-classes", "ready", { timeout: 20_000 });
  await page.waitForTimeout(500);
  await expect(galaxy(page)).toHaveAttribute("data-intro", "idle");
  await page.getByRole("button", { name: "Run the intro" }).click();
  await expect(galaxy(page)).toHaveAttribute("data-intro", "play");
});

test("without similarity the arcs and titles still play, and the ledger says so", async ({ page }) => {
  await withIdea(page, "fail");
  await page.goto("/");
  await expect(galaxy(page)).toHaveAttribute("data-scan", "done", { timeout: 25_000 });
  const texts = (await tags(page).allInnerTexts()).map((t) => t.replace(/\s+/g, " "));
  expect(texts).toEqual(near.map((p) => short(p.title)));
  await expect(readout(page)).toContainText("similarity unavailable");
});

test("phone: the readout is one ledger line and the map keeps its space", async ({ browser }, info) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await withIdea(page);
  await page.goto("/");
  await expect(galaxy(page)).toHaveAttribute("data-scan", "done", { timeout: 25_000 });
  await expect(readout(page)).toContainText("5 nearest linked");
  await expect(readout(page).getByRole("list")).toBeHidden();
  await page.screenshot({ path: info.outputPath("phone.png") });
  await page.close();
});
