import { expect, test } from "vitest";
import { buildBoard, layers, type PR, type Raw } from "@/lib/foreman/board";
import { firstGap, frontMatter, isVerified, parseMilestonesToml, parseTitle, parseWhen, workerOf } from "@/lib/foreman/parse";

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
  paths: [],
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
  mainCi: "success",
};

test("states follow AGENTS.md: done, in flight, ready, blocked, cut, backlog", () => {
  const b = buildBoard(raw, NOW);
  const state = Object.fromEntries(b.features.map((f) => [f.slug, f.state]));
  // b has an open feat PR, so it's in flight even though stale; c waits on b; d is in flight; f is in no milestone.
  expect(state).toEqual({ a: "done", b: "flight", c: "blocked", d: "flight", e: "cut", f: "backlog", foreman: "ready" });
  expect(b.features.find((f) => f.slug === "a")).toMatchObject({ verified: true, fixes: 1, doneAt: "2026-10-10T12:30:00Z" });
  expect(b.features.find((f) => f.slug === "d")?.worker).toBe("kiro-agent-1");
});

test("milestones count done of total without cut features, and resolve every time form", () => {
  const [core, sub] = buildBoard(raw, NOW).milestones;
  expect(core).toMatchObject({ name: "core", done: 1, total: 4, ship: Date.parse("2026-10-10T15:00:00-04:00") });
  expect(sub.freeze).toBe(Date.parse("2026-10-11T06:00:00-04:00"));
  expect(sub.report).toBe(Date.parse("2026-10-11T09:00:00-04:00"));
});

test("needs a person: plan PRs to merge, stale drafts, flagged issues, red main", () => {
  const asks = buildBoard({ ...raw, mainCi: "failure" }, NOW).asks.map((a) => `${a.kind}:${a.title}`);
  expect(asks).toEqual(["ci:main is red", "merge:plan: move things", "stale:feat(b): old claim", "issue:Need a key"]);
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
