import { expect, test } from "vitest";
import { buildBoard, layers, pace, statesAt, type PR, type Raw } from "@/lib/foreman/board";
import { firstGap, frontMatter, isVerified, parseMilestonesToml, parseTitle, parseWhen, workerNoteOf, workerOf } from "@/lib/foreman/parse";

const NOW = Date.parse("2026-10-10T14:00:00Z");
const spec = (deps: string[]) => `---\nname: x\ndepends_on: [${deps.join(", ")}]\nowns: []\nassignee: ""\n---\n`;
const note = (check: string, gaps = "None.") =>
  `## What shipped\nIt works.\n## Where it lives\nlib/\n## How to check it\n${check}\n## Gaps\n${gaps}\n`;
const pr = (n: number, title: string, over: Partial<PR> = {}): PR => ({
  number: n,
  title,
  draft: true,
  state: "open",
  createdAt: "2026-10-10T13:00:00Z",
  updatedAt: "2026-10-10T13:50:00Z",
  closedAt: null,
  mergedAt: null,
  url: `https://github.com/o/r/pull/${n}`,
  body: "Worker: kiro-agent-1.",
  headSha: "abc",
  ...over,
});

const TOML = `start = "2026-10-09T19:00:00-04:00"   # opening
[[milestone]]
name = "core"   # R1
ship = "+20:00"
features = ["a", "b", "c",
  "d", "e"]
cut = ["e"]

[[milestone]]
name = "submission"
ship = "2026-10-11T10:45:00-04:00"
freeze = "4:45"
final = true
report_before = "1:45"
features = []
allow = ["foreman"]
`;

const raw: Raw = {
  repo: "o/r",
  sha: "abc",
  fetchedAt: "2026-10-10T14:00:00Z",
  stop: false,
  files: {
    "specs/milestones.toml": TOML,
    "specs/features/a/spec.md": spec([]),
    "specs/features/b/spec.md": spec(["a"]),
    "specs/features/c/spec.md": spec(["b"]),
    "specs/features/d/spec.md": spec(["a"]),
    "specs/features/e/spec.md": spec([]),
    "specs/features/f/spec.md": spec([]),
    "specs/features/foreman/spec.md": spec([]),
    "specs/features/_template/spec.md": spec([]),
    "changes/a.md": note("- verify: `node scripts/verify.mjs a out` pass at abc"),
  },
  prs: [
    pr(3, "feat(d): the d page"),
    pr(4, "plan: move things", { draft: false }),
    pr(5, "feat(b): old claim", { updatedAt: "2026-10-10T12:00:00Z" }),
    pr(1, "feat(a): the a thing (#1)", { state: "closed", mergedAt: "2026-10-10T12:30:00Z", createdAt: "2026-10-10T12:00:00Z" }),
    pr(2, "fix(a): repair it", { state: "closed", mergedAt: "2026-10-10T13:30:00Z" }),
  ],
  issues: [
    { number: 9, title: "Need a key", url: "u", labels: ["needs-human"], createdAt: "" },
    { number: 10, title: "Just a bug", url: "u", labels: ["bug"], createdAt: "" },
  ],
  prsKnown: true,
  mainCi: "success",
  mainCiUrl: null,
  api: { token: true, calls: 5, remaining: 4990, limit: 5000, error: null },
};

test("states follow AGENTS.md: done, in flight, ready, blocked, cut, backlog", () => {
  const b = buildBoard(raw, NOW);
  const state = Object.fromEntries(b.features.map((f) => [f.slug, f.state]));
  // b has an open feat PR, so it's in flight even though stale; c waits on b; d is in flight; f is in no milestone.
  expect(state).toEqual({ a: "done", b: "flight", c: "blocked", d: "flight", e: "cut", f: "backlog", foreman: "ready" });
  expect(b.features.find((f) => f.slug === "a")).toMatchObject({ verified: true, fixes: 1, doneAt: "2026-10-10T12:30:00Z" });
  expect(b.features.find((f) => f.slug === "d")?.worker).toBe("kiro-agent-1");
  expect(b.features.find((f) => f.slug === "d")?.specDir).toBe("specs/features/d");
});

test("the intro's crew counts named workers with a merged PR; its clock starts at the first PR", () => {
  const b = buildBoard(raw, NOW);
  expect(b.stats.crew).toBe(1); // only kiro-agent-1 has merged anything
  expect(b.stats.firstPrAt).toBe("2026-10-10T12:00:00Z");
});

test("milestones count done of total without cut features, and resolve every time form", () => {
  const [core, sub] = buildBoard(raw, NOW).milestones;
  expect(core).toMatchObject({ name: "core", done: 1, total: 4, ship: Date.parse("2026-10-10T15:00:00-04:00") });
  expect(sub.freeze).toBe(Date.parse("2026-10-11T06:00:00-04:00"));
  expect(sub.report).toBe(Date.parse("2026-10-11T09:00:00-04:00"));
});

test("needs a person: plan PRs to merge, stale drafts, flagged issues, red main", () => {
  const asks = buildBoard({ ...raw, mainCi: "failure" }, NOW).asks.map((a) => `${a.kind}:${a.title}`);
  expect(asks).toEqual([
    "ci:main is red",
    "merge:plan: move things",
    "stale:feat(b): old claim",
    "issue:Need a key",
    "pickable:e is cut but still pickable",
  ]);
});

test("two open feat PRs on one feature are flagged, naming the first claim", () => {
  const prs = [...raw.prs, pr(7, "feat(d): the same d page", { body: "Worker: eric-claude-agent-1" })];
  const clash = buildBoard({ ...raw, prs }, NOW).asks.find((a) => a.kind === "clash");
  expect(clash?.detail).toBe("#3 (kiro-agent-1) claimed it first; #7 (eric-claude-agent-1) duplicate it");
});

test("a done note with a gap or no passing verify line is flagged for review", () => {
  const files = { ...raw.files, "changes/a.md": note("not verified: no browser", "- Untested on mobile.") };
  const ask = buildBoard({ ...raw, files }, NOW).asks.find((a) => a.kind === "review");
  expect(ask?.detail).toBe("not verified · Untested on mobile.");
});

test("parsers match status.py on its edge cases", () => {
  expect(parseTitle("feat: no scope")).toBeNull();
  expect(parseTitle('Revert "feat(a): x"')?.kind).toBe("revert");
  expect(parseTitle("chore(a)!: y")).toEqual({ kind: "fix", type: "chore", scope: "a" });
  expect(isVerified(note("- verify: `x` pass at 1\n- verify: `y` FAIL"))).toBe(false);
  expect(firstGap(note("x", "None known."))).toBe("");
  expect(parseWhen("2026-10-11", null)).toBe(Date.parse("2026-10-12T00:00:00Z"));
  expect(frontMatter("---\nowns:\n  - app/\n  - lib/\n---\n").owns).toEqual(["app/", "lib/"]);
  expect(parseMilestonesToml(TOML).milestone[0].features).toEqual(["a", "b", "c", "d", "e"]);
  expect(workerOf("Worker: `foreman`")).toBe("foreman");
  expect(workerNoteOf("Worker: kiro-agent-1 (GPT-6 Astra / Windows). Git author: Kiro.")).toBe("GPT-6 Astra / Windows");
  expect(workerNoteOf("Worker: planner. Self-merges (later)")).toBeNull();
});

test("layers put a feature one column right of its deepest dependency, and survive a cycle", () => {
  const d = layers([
    { slug: "a", deps: [] },
    { slug: "b", deps: ["a"] },
    { slug: "c", deps: ["a", "b", "missing"] },
  ]);
  expect([...d.entries()]).toEqual([["a", 0], ["b", 1], ["c", 2]]);
  expect(layers([{ slug: "x", deps: ["y"] }, { slug: "y", deps: ["x"] }]).size).toBe(2);
});

test("replay states come from PR history: in flight while open, done once merged", () => {
  const f = buildBoard(raw, NOW).features;
  const at = (iso: string) => Object.fromEntries(statesAt(f, Date.parse(iso)));
  // Before a's PR opened: a is ready, b waits on it. While #1 was open: a in flight. After it merged: a done.
  expect(at("2026-10-10T11:00:00Z")).toMatchObject({ a: "ready", b: "blocked", e: "cut", f: "backlog" });
  expect(at("2026-10-10T12:10:00Z")).toMatchObject({ a: "flight", b: "blocked" });
  expect(at("2026-10-10T12:45:00Z")).toMatchObject({ a: "done", b: "ready", d: "ready" });
  expect(at("2026-10-10T13:30:00Z")).toMatchObject({ a: "done", b: "flight", d: "flight" });
});

test("build time runs from the first feat PR to its merge; unfinished features of a shipped milestone are missed", () => {
  const f = buildBoard(raw, NOW).features;
  expect(f.find((x) => x.slug === "a")?.buildMin).toBe(30);
  expect(f.some((x) => x.missed)).toBe(false); // core ships 15:00 EDT, after NOW
  const later = buildBoard(raw, Date.parse("2026-10-10T16:00:00-04:00")).features;
  expect(later.filter((x) => x.missed).map((x) => x.slug)).toEqual(["b", "c", "d"]); // e is cut, a is done
});

test("heat is PR activity in the 3h before the snapshot, weighted toward the most recent", () => {
  const heat = Object.fromEntries(buildBoard(raw, NOW).features.map((f) => [f.slug, f.heat]));
  expect(heat.a).toBe(1); // #1 and #2, both touched 10 min before the snapshot
  expect(heat.d).toBe(0.5); // #3 alone, same age
  expect(heat.b).toBeGreaterThan(0); // #5, touched 2h before: inside the window, colder
  expect(heat.b).toBeLessThan(heat.d);
  expect(heat.c).toBe(0); // no PR
});

test("without PR data, features that could be in flight are unknown; done, cut and backlog still come from files", () => {
  const b = buildBoard({ ...raw, prs: [], issues: [], prsKnown: false, mainCi: "unknown" }, NOW);
  const state = Object.fromEntries(b.features.map((f) => [f.slug, f.state]));
  expect(state).toEqual({ a: "done", b: "unknown", c: "unknown", d: "unknown", e: "cut", f: "backlog", foreman: "unknown" });
  expect(b.asks.map((a) => a.kind)).not.toContain("ci");
});

test("a STOP file and a red main are the first asks", () => {
  const b = buildBoard({ ...raw, stop: true, mainCi: "failure", mainCiUrl: "run" }, NOW);
  expect(b.asks.slice(0, 2).map((a) => [a.kind, a.url])).toEqual([["stop", null], ["ci", "run"]]);
});

test("a feature on the cut list that someone is building shows as in flight", () => {
  const prs = [...raw.prs, pr(8, "feat(e): build it anyway")];
  const e = buildBoard({ ...raw, prs }, NOW).features.find((f) => f.slug === "e");
  expect(e?.state).toBe("flight");
});

test("pace projects the remaining features at the last 3h's build rate, or says there's no pace", () => {
  const at = (h: number) => ({ doneAt: new Date(NOW - h * 3_600_000).toISOString() });
  // 3 built in the last 3h -> 1/h; 2 left -> done in 2h.
  expect(pace({ done: 3, total: 5 }, [at(0.5), at(1), at(2.5), at(5)], NOW)).toEqual({ left: 2, perHour: 1, eta: NOW + 2 * 3_600_000 });
  expect(pace({ done: 3, total: 5 }, [at(4), { doneAt: null }], NOW)).toBeNull();
  expect(pace({ done: 5, total: 5 }, [at(1)], NOW)).toBeNull();
});

test("a cut feature still in its milestone's features with dependencies done is flagged as pickable", () => {
  const asks = buildBoard(raw, NOW).asks.filter((a) => a.kind === "pickable").map((a) => a.title);
  expect(asks).toEqual(["e is cut but still pickable"]); // e: cut in core, no deps, core not shipped
  const later = buildBoard(raw, Date.parse("2026-10-10T16:00:00-04:00")).asks.filter((a) => a.kind === "pickable");
  expect(later).toEqual([]); // core has shipped: nothing left to pick
});
