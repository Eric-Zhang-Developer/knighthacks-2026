import { expect, test, type Page } from "@playwright/test";

// The 3D galaxy (specs/features/galaxy-3d, Validation 2-5), on the committed corpus. Positions and screen points are
// read back through the canvas, so they're exact, not guessed from pixels.
type Pt = { x: number; y: number };
type Canvas = HTMLCanvasElement & {
  starPositions: ArrayLike<number>;
  starView: { moving: boolean; fit(): void };
  starScreen(idx: number[]): Pt[];
  starMorph: { t: number; current: Float32Array };
};

const galaxy = (page: Page) => page.locator("[data-star-count]");
const canvas = (page: Page) => page.locator("canvas");
const ready = async (page: Page) => {
  await expect.poll(() => canvas(page).evaluate((c) => "starMorph" in c && "starScreen" in c)).toBe(true);
  return (await canvas(page).boundingBox())!;
};
const settled = (page: Page) =>
  expect.poll(() => canvas(page).evaluate((c) => !(c as Canvas).starView.moving && (c as Canvas).starMorph.t === 1)).toBe(true);
const screenOf = (page: Page, idx: number[]) => canvas(page).evaluate((c, idx) => (c as Canvas).starScreen(idx), idx);
const realXyz = (page: Page) =>
  page.evaluate(() =>
    fetch("/corpus/stars.json")
      .then((r) => r.json())
      .then((s: { stars: { x: number; y: number; z: number }[] }) => s.stars.flatMap((p) => [p.x, p.y, p.z])),
  );
const maxDiff = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
};
const now = (page: Page) => canvas(page).evaluate((c) => Array.from((c as Canvas).starMorph.current));
const target = (page: Page) => canvas(page).evaluate((c) => Array.from((c as Canvas).starPositions));

test("each layout loads from the URL; by category is the default", async ({ page }, info) => {
  for (const [url, layout] of [
    ["/", "clouds"],
    ["/?layout=clouds", "clouds"],
    ["/?layout=nebula", "nebula"],
  ]) {
    await page.goto(url);
    await ready(page);
    await expect(galaxy(page)).toHaveAttribute("data-layout", layout);
    await expect(page.getByRole("button", { name: layout === "clouds" ? "By category" : "By meaning" })).toHaveAttribute("aria-pressed", "true");
  }
  await expect(galaxy(page)).toHaveAttribute("data-classes", "ready");
  expect(maxDiff(await target(page), await realXyz(page))).toBeLessThan(1e-4); // by meaning = stars.json
  await settled(page);
  await page.screenshot({ path: info.outputPath("nebula-desktop.png") });
});

test("the toggle flies every star to the other layout and updates the URL", async ({ page }, info) => {
  await page.goto("/?layout=clouds");
  await ready(page);
  await expect(galaxy(page)).toHaveAttribute("data-classes", "ready");
  await settled(page);
  const clouds = await target(page);
  const real = await realXyz(page);
  expect(maxDiff(clouds, real)).toBeGreaterThan(0.05); // the layouts really differ
  await page.screenshot({ path: info.outputPath("clouds-desktop.png") });

  await page.getByRole("button", { name: "By meaning" }).click();
  await expect(page).toHaveURL(/layout=nebula/);
  // Mid-flight the stars are in neither layout. Read t and the positions in one call, so a frame can't land between.
  let mid: number[] = [];
  await expect
    .poll(async () => {
      const m = await canvas(page).evaluate((c) => ({ t: (c as Canvas).starMorph.t, p: Array.from((c as Canvas).starMorph.current) }));
      mid = m.p;
      return m.t > 0.2 && m.t < 1;
    }, { intervals: [50] })
    .toBe(true);
  expect(maxDiff(mid, clouds)).toBeGreaterThan(0.01);
  expect(maxDiff(mid, real)).toBeGreaterThan(0.01);
  await page.screenshot({ path: info.outputPath("mid-flight.png") });
  // Within 2.5 s they've landed on the real positions.
  await expect.poll(() => now(page).then((p) => maxDiff(p, real)), { timeout: 2500 }).toBeLessThan(1e-4);
});

test("with reduced motion the switch lands on the next frame", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?layout=clouds");
  await ready(page);
  await expect(galaxy(page)).toHaveAttribute("data-classes", "ready");
  const real = await realXyz(page);
  await page.getByRole("button", { name: "By meaning" }).click();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  expect(maxDiff(await now(page), real)).toBeLessThan(1e-4);
});

test("dragging turns the camera, not the stars", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); // no drift, so only the drag moves the camera
  await page.goto("/?layout=nebula");
  const box = await ready(page);
  await settled(page);
  const before = await target(page);
  const [a] = await screenOf(page, [0]);
  await page.mouse.move(box.x + 60, box.y + box.height - 60);
  await page.mouse.down();
  await page.mouse.move(box.x + 260, box.y + box.height - 60, { steps: 12 });
  await page.mouse.up();
  await settled(page);
  const [a2] = await screenOf(page, [0]);
  expect(Math.hypot(a2.x - a.x, a2.y - a.y)).toBeGreaterThan(20);
  expect(maxDiff(await target(page), before)).toBe(0);
});

test("a right-drag turns the camera; a left-drag doesn't", async ({ page }) => {
  test.slow(); // two drags, each waiting for software GL to settle
  await page.emulateMedia({ reducedMotion: "reduce" }); // no drift, so only the drag moves the camera
  await page.goto("/?layout=nebula");
  const box = await ready(page);
  await settled(page);
  const angles = () => canvas(page).evaluate((c) => { const v = (c as Canvas & { starView: { yaw: number; pitch: number } }).starView; return [v.yaw, v.pitch]; });
  const drag = async (button: "left" | "right") => {
    await page.mouse.move(box.x + 60, box.y + box.height - 60);
    await page.mouse.down({ button });
    await page.mouse.move(box.x + 260, box.y + box.height - 60, { steps: 12 });
    await page.mouse.up({ button });
    await settled(page);
  };
  const start = await angles();
  await drag("left");
  expect(await angles()).toEqual(start);
  await drag("right");
  const [yaw] = await angles();
  expect(Math.abs(yaw - start[0])).toBeGreaterThan(0.2); // 200px at 0.002 rad/px
});

test("picking a project centres it; fit shows the galaxy in both layouts", async ({ page }, info) => {
  // Software GL draws a few frames a second, so each click waits seconds for a stable frame; the 1.5 s bound below is
  // still checked, this only stops the whole test running out of its 30 s.
  test.slow();
  await page.goto("/?layout=clouds");
  const box = await ready(page);
  await expect(galaxy(page)).toHaveAttribute("data-classes", "ready");

  await page.locator("summary", { hasText: /^Projects \(/ }).click();
  await page.getByRole("list", { name: "Projects" }).getByRole("button").nth(40).click();
  const id = await galaxy(page).getAttribute("data-selected-id");
  const index = await page.evaluate(
    (id) => fetch("/corpus/stars.json").then((r) => r.json()).then((s: { stars: { id: string }[] }) => s.stars.findIndex((x) => x.id === id)),
    id,
  );
  await page.waitForTimeout(1500);
  const [p] = await screenOf(page, [index]);
  expect(Math.abs(p.x - box.width / 2)).toBeLessThanOrEqual(6);
  expect(Math.abs(p.y - box.height / 2)).toBeLessThanOrEqual(6);
  await page.screenshot({ path: info.outputPath("selected.png") });

  for (const layout of ["By category", "By meaning"]) {
    await page.getByRole("button", { name: layout }).click();
    await page.getByRole("button", { name: "Show the whole map" }).click();
    await settled(page);
    const n = Number(await galaxy(page).getAttribute("data-star-count"));
    const all = await screenOf(page, Array.from({ length: n }, (_, i) => i));
    const inside = all.filter((s) => s.x >= 0 && s.y >= 0 && s.x <= box.width && s.y <= box.height).length;
    expect(inside / n).toBeGreaterThanOrEqual(0.97);
  }
});

test("phone: the map keeps its space", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?layout=clouds");
  const box = await ready(page);
  await settled(page);
  expect(box.height).toBeGreaterThanOrEqual(200);
  await page.screenshot({ path: info.outputPath("phone.png") });
});
