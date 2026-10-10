// Scale benchmark: node scale/bench.mjs <port> <dataDir> <sizes,comma> <throttles,comma>
// Serves stars-<N>.json and classes-<N>.json in place of the real files, then times load, hover, a history step and
// a category filter. Prints one JSON line per run.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const log = (...a) => process.stdout.write(a.join(" ") + "\n");
const [port, dir, sizes, throttles] = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--enable-precise-memory-info"] });
const ms = (x) => Math.round(x);
for (const n of sizes.split(",")) for (const rate of throttles.split(",").map(Number)) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  const stars = readFileSync(`${dir}/stars-${n}.json`), classes = readFileSync(`${dir}/classes-${n}.json`);
  await page.route("**/corpus/stars.json", (r) => r.fulfill({ body: stars, contentType: "application/json" }));
  await page.route("**/api/classes", (r) => r.fulfill({ body: classes, contentType: "application/json" }));
  await page.addInitScript(() => {
    window.__lt = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(e.duration))).observe({ type: "longtask", buffered: true });
  });
  const r = { n: Number(n), cpu: `${rate}x` };
  const t0 = Date.now();
  try {
    await page.goto(`http://localhost:${port}/`);
    await page.locator("[data-star-count]").waitFor({ timeout: 300000 });
    r.starsMs = Date.now() - t0;
    await page.locator('[data-classes="ready"]').waitFor({ timeout: 300000 });
    r.readyMs = Date.now() - t0;
    await page.waitForTimeout(1500);
    const lt = await page.evaluate(() => window.__lt);
    r.longTaskMs = ms(lt.reduce((a, b) => a + b, 0));
    r.worstTaskMs = ms(Math.max(0, ...lt));
    r.heapMB = await page.evaluate(() => Math.round(performance.memory.usedJSHeapSize / 1e6));
    r.domNodes = await page.evaluate(() => document.getElementsByTagName("*").length);
    // Hover: a pointer move over the dense centre, timed until two frames have painted after it.
    const box = await page.locator("canvas").boundingBox();
    const hovers = [];
    for (let i = 0; i < 6; i++) {
      hovers.push(await page.evaluate(([x, y]) => new Promise((res) => {
        const c = document.querySelector("canvas"), t = performance.now();
        c.dispatchEvent(new PointerEvent("pointermove", { clientX: x, clientY: y, bubbles: true }));
        requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now() - t)));
      }), [box.x + box.width / 2 + i * 3, box.y + box.height / 2 + i * 2]));
    }
    r.hoverMs = ms(hovers.sort((a, b) => a - b)[3]);
    // One step: click, then wait for the visible count to change and two frames to paint.
    const step = (click) => page.evaluate((sel) => new Promise((res) => {
      const g = document.querySelector("[data-visible-count]"), before = g.dataset.visibleCount, t = performance.now();
      const done = () => requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now() - t)));
      new MutationObserver((_, o) => { if (g.dataset.visibleCount !== before) { o.disconnect(); done(); } }).observe(g, { attributes: true });
      document.querySelector(sel).click();
    }), click);
    r.historyStepMs = ms(await step('[aria-label="Reveal by created year"] button'));
    r.filterMs = ms(await step('[aria-label="Categories"] button[aria-pressed]'));
  } catch (e) {
    r.error = String(e.message).split("\n")[0].slice(0, 120);
    r.elapsedMs = Date.now() - t0;
  }
  log(JSON.stringify(r));
  await ctx.close();
}
await browser.close();
