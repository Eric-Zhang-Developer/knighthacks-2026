import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("next/dist/compiled/server-only", () => ({}));
const { readRaw, CI_CAP } = await import("@/lib/foreman/collect");

const NOW = Date.parse("2026-10-10T16:00:00Z");
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "x-ratelimit-remaining": "4990", "x-ratelimit-limit": "5000" } });
const ghPr = (n: number, state: "open" | "closed") => ({
  number: n,
  title: `feat(x${n}): thing`,
  draft: true,
  state,
  created_at: "2026-10-10T15:00:00Z",
  updated_at: "2026-10-10T15:00:00Z",
  closed_at: null,
  merged_at: null,
  html_url: `u${n}`,
  body: "Worker: w",
  head: { sha: `h${n}` },
});
// A fake GitHub: these PRs, no issues, main's last run red, PR 1's checks failing and every other PR's absent.
const github = (prs: ReturnType<typeof ghPr>[]) =>
  vi.fn(async (url: string, _init?: RequestInit) => {
    if (url.includes("/pulls?")) return json(prs);
    if (url.includes("/issues?")) return json([]);
    if (url.includes("/actions/runs?")) return json({ workflow_runs: [{ conclusion: "failure", html_url: "run-url" }] });
    if (url.includes("/commits/h1/check-runs")) return json({ check_runs: [{ status: "completed", conclusion: "failure" }] });
    if (url.includes("/check-runs")) return json({ check_runs: [] });
    return json({}, 404);
  });

afterEach(() => vi.unstubAllGlobals());

test("with no token, the snapshot reads the repo files on disk and makes no network call", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const raw = await readRaw({ token: "", now: NOW });
  expect(fetch).not.toHaveBeenCalled();
  expect(raw).toMatchObject({ prsKnown: false, prs: [], mainCi: "unknown", api: { token: false, calls: 0, error: null } });
  const specs = readdirSync("specs/features").filter((d) => !d.startsWith("_"));
  expect(Object.keys(raw.files).filter((p) => p.startsWith("specs/features/"))).toHaveLength(specs.length);
  expect(raw.files["specs/milestones.toml"]).toContain("[[milestone]]");
  expect(raw.files["changes/foreman.md"]).toContain("## What shipped");
});

test("with the API refusing, it stops at the first call and keeps the board's files", async () => {
  const fetch = vi.fn(async () => json({ message: "API rate limit exceeded" }, 403));
  vi.stubGlobal("fetch", fetch);
  const raw = await readRaw({ token: "t", now: NOW });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(raw.api).toMatchObject({ token: true, calls: 1, error: "GitHub 403 on /pulls (rate limit?)" });
  expect(raw).toMatchObject({ prsKnown: false, prs: [], issues: [] });
  expect(raw.files["specs/milestones.toml"]).toBeTruthy();
});

test("a healthy pass stays in budget: PR pages, issues, main's last run, one CI read per open PR, never cached", async () => {
  const fetch = github([ghPr(3, "closed"), ghPr(2, "open"), ghPr(1, "open")]);
  vi.stubGlobal("fetch", fetch);
  const raw = await readRaw({ token: "t", now: NOW });
  expect(fetch).toHaveBeenCalledTimes(5); // 1 PR page + issues + main run + 2 open PRs
  expect(raw.api).toMatchObject({ calls: 5, remaining: 4990, limit: 5000, error: null });
  expect(raw).toMatchObject({ prsKnown: true, mainCi: "failure", mainCiUrl: "run-url", fetchedAt: new Date(NOW).toISOString() });
  expect(Object.fromEntries(raw.prs.map((p) => [p.number, p.ci]))).toEqual({ 1: "failure", 2: "none", 3: undefined });
  // Next's data cache survives Vercel builds; a cached response would freeze every later snapshot.
  for (const [, init] of fetch.mock.calls) expect(init?.cache).toBe("no-store");
});

test(`CI is read for the ${CI_CAP} newest open PRs; older ones are unknown, not guessed`, async () => {
  const prs = Array.from({ length: CI_CAP + 5 }, (_, i) => ghPr(100 - i, "open"));
  const fetch = github(prs);
  vi.stubGlobal("fetch", fetch);
  const raw = await readRaw({ token: "t", now: NOW });
  expect(fetch).toHaveBeenCalledTimes(3 + CI_CAP);
  expect(raw.prs.slice(CI_CAP).every((p) => p.ci === "unknown")).toBe(true);
  expect(raw.prs.slice(0, CI_CAP).every((p) => p.ci === "none")).toBe(true);
});

test("a checkout with no milestones.toml fails the build loudly", async () => {
  await expect(readRaw({ root: mkdtempSync(join(tmpdir(), "foreman-")), token: "" })).rejects.toThrow(/milestones\.toml not found/);
});
