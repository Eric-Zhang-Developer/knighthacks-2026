import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const log = (...a) => process.stdout.write(a.join(" ") + "\n");
const [port, dir, n] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const cdp = await page.context().newCDPSession(page);
await page.route("**/corpus/stars.json", (r) => r.fulfill({ body: readFileSync(`${dir}/stars-${n}.json`), contentType: "application/json" }));
await page.route("**/api/classes", (r) => r.fulfill({ body: readFileSync(`${dir}/classes-${n}.json`), contentType: "application/json" }));
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
await cdp.send("Profiler.start");
await page.goto(`http://localhost:${port}/`);
await page.locator('[data-classes="ready"]').waitFor({ timeout: 300000 });
await page.waitForTimeout(1500);
const { profile } = await cdp.send("Profiler.stop");
const dt = profile.timeDeltas, self = new Map(), byId = new Map(profile.nodes.map((x) => [x.id, x]));
profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (dt[i] ?? 0)));
// Self time per function, and inclusive time for a few named frames.
const agg = new Map();
for (const [id, t] of self) { const f = byId.get(id).callFrame; const k = `${f.functionName || "(anon)"} ${f.url.split("/").pop()}:${f.lineNumber}`; agg.set(k, (agg.get(k) ?? 0) + t); }
const parent = new Map(); for (const x of profile.nodes) for (const c of x.children ?? []) parent.set(c, x.id);
const incl = new Map();
for (const [id, t] of self) { const seen = new Set(); for (let p = id; p; p = parent.get(p)) { const f = byId.get(p).callFrame.functionName; if (f && !seen.has(f)) { seen.add(f); incl.set(f, (incl.get(f) ?? 0) + t); } } }
log("SELF top 15");
[...agg].sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, t]) => log((t / 1000).toFixed(0).padStart(6), "ms", k));
log("INCLUSIVE named");
for (const f of ["compactRegions", "parseClasses", "parseStars", "safeParse", "parse", "counts", "revealMask", "Galaxy", "Legend", "Category", "Meta", "commitRoot", "performWorkOnRoot", "StarPoints", "median", "mean", "JSON.parse"]) if (incl.has(f)) log((incl.get(f) / 1000).toFixed(0).padStart(6), "ms", f);
await browser.close();
