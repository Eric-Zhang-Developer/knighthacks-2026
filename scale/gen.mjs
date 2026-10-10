// Scale-test data only (branch scale-test, never merged): the real 8,409 stars replicated to N with small jitter,
// copies titled "(copy k)", plus synthetic categories so colours, rings and region labels do real work.
// Usage: node scale/gen.mjs <N> <outDir>  ->  <outDir>/stars-<N>.json, <outDir>/classes-<N>.json
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const log = (...a) => process.stdout.write(a.join(" ") + "\n");
const [n, out] = [Number(process.argv[2]), process.argv[3]];
const real = JSON.parse(readFileSync(new URL("../public/corpus/stars.json", import.meta.url))).stars;
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
const span = Math.max(...real.map((s) => Math.hypot(s.x, s.y, s.z)));
const stars = [];
for (let i = 0; i < n; i++) {
  const s = real[i % real.length], k = Math.floor(i / real.length), j = k ? span * 0.004 : 0;
  stars.push({ ...s, id: k ? `${s.id}~${k}` : s.id, title: k ? `${s.title} (copy ${k})` : s.title,
    x: s.x + gauss() * j, y: s.y + gauss() * j, z: s.z + gauss() * j });
}
const ids = ["health", "education", "finance", "climate", "accessibility", "productivity", "social", "gaming", "security", "devtools", "entertainment", "transport"];
const centres = ids.map(() => real[Math.floor(rand() * real.length)]);
const projects = {};
for (const s of stars) {
  let best = 0, bd = Infinity;
  centres.forEach((c, d) => { const v = (c.x - s.x) ** 2 + (c.y - s.y) ** 2 + (c.z - s.z) ** 2; if (v < bd) [bd, best] = [v, d]; });
  const r = rand();
  projects[s.id] = { domain: r < 0.9 ? ids[best] : null, status: r < 0.9 ? "clear" : r < 0.95 ? "mixed" : "insufficient_text", runner_up: null,
    prizes: rand() < 0.03 ? [{ event: s.event ?? null, text: "1st Place", kind: "placement", place: 1, sponsor: null }] : [] };
}
const version = `scale-test-${n}`;
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/stars-${n}.json`, JSON.stringify({ corpus_version: version, count: n, stars }));
writeFileSync(`${out}/classes-${n}.json`, JSON.stringify({ corpus_version: version, domains: ids.map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1) })), projects }));
log(n, "stars", (JSON.stringify(stars).length / 1e6).toFixed(1), "MB");
