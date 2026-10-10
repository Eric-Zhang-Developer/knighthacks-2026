import "next/dist/compiled/server-only";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Api, Ci, Issue, PR, Raw } from "./board";

export const REPO = "Eric-Zhang-Developer/knighthacks-2026";
export const CI_CAP = 25; // open PRs whose CI is read; older ones show unknown (spec: Defaults)
const TIMEOUT_MS = 10_000;

// The snapshot (specs/features/foreman/spec.md § Architecture): runs once per build. Repo files come from the
// checkout being built; PRs, issues and CI from one bounded pass of API calls, only with a token. Nothing here
// runs when someone views the page.

/** specs/features/*\/spec.md, specs/shipped/*\/*\/spec.md, changes/*.md and specs/milestones.toml, from disk. */
export function readRepoFiles(root: string): Record<string, string> {
  const files: Record<string, string> = {};
  const read = (rel: string) => {
    if (existsSync(join(root, rel))) files[rel] = readFileSync(join(root, rel), "utf8");
  };
  const ls = (rel: string, dirs: boolean) =>
    existsSync(join(root, rel))
      ? readdirSync(join(root, rel), { withFileTypes: true })
          .filter((d) => d.isDirectory() === dirs)
          .map((d) => d.name)
      : [];
  read("specs/milestones.toml");
  for (const slug of ls("specs/features", true)) if (!slug.startsWith("_")) read(`specs/features/${slug}/spec.md`);
  for (const m of ls("specs/shipped", true)) for (const slug of ls(`specs/shipped/${m}`, true)) read(`specs/shipped/${m}/${slug}/spec.md`);
  for (const f of ls("changes", false)) if (f.endsWith(".md")) read(`changes/${f}`);
  return files;
}

type GhPR = {
  number: number;
  title: string;
  draft: boolean;
  state: "open" | "closed";
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  html_url: string;
  body: string | null;
  head: { sha: string };
};
type GhIssue = { number: number; title: string; html_url: string; created_at: string; labels: { name: string }[]; pull_request?: unknown };

/** The one API pass. Throws on the first refusal of PRs or issues; a CI read that fails is just unknown. */
async function readGitHub(api: Api, token: string) {
  const get = async <T,>(path: string): Promise<T> => {
    api.calls++;
    const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
      // Never into Next's data cache: Vercel restores it between builds, which would freeze the snapshot.
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.headers.has("x-ratelimit-remaining")) {
      api.remaining = Number(res.headers.get("x-ratelimit-remaining"));
      api.limit = Number(res.headers.get("x-ratelimit-limit"));
    }
    if (!res.ok) throw new Error(`GitHub ${res.status} on ${path.split("?")[0]}${res.status === 403 || res.status === 429 ? " (rate limit?)" : ""}`);
    return (await res.json()) as T;
  };

  const pages: GhPR[] = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await get<GhPR[]>(`/pulls?state=all&sort=created&direction=desc&per_page=100&page=${page}`);
    pages.push(...batch);
    if (batch.length < 100) break;
  }
  const prs: PR[] = pages.map((p) => ({
    number: p.number,
    title: p.title,
    draft: p.draft,
    state: p.state,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    closedAt: p.closed_at,
    mergedAt: p.merged_at,
    url: p.html_url,
    body: p.body,
    headSha: p.head.sha,
  }));
  const issues: Issue[] = (await get<GhIssue[]>("/issues?state=open&per_page=100"))
    .filter((i) => !i.pull_request)
    .map((i) => ({ number: i.number, title: i.title, url: i.html_url, createdAt: i.created_at, labels: i.labels.map((l) => l.name) }));

  // Main: the latest finished push run, not the commit being built (its own CI is still running during the build).
  const mainRun = get<{ workflow_runs: { conclusion: string | null; html_url: string }[] }>(
    "/actions/runs?branch=main&event=push&status=completed&per_page=1",
  ).then(
    ({ workflow_runs: [r] }) => (r ? { ci: (r.conclusion === "success" ? "success" : "failure") as Ci, url: r.html_url } : null),
    () => null,
  );
  const prCi = async (sha: string): Promise<Ci> => {
    const { check_runs } = await get<{ check_runs: { status: string; conclusion: string | null }[] }>(`/commits/${sha}/check-runs?per_page=100`);
    if (!check_runs.length) return "none";
    if (check_runs.some((r) => ["failure", "timed_out", "cancelled", "action_required"].includes(r.conclusion ?? ""))) return "failure";
    return check_runs.some((r) => r.status !== "completed") ? "pending" : "success";
  };
  const open = prs.filter((p) => p.state === "open"); // newest first
  const [main, ...openCi] = await Promise.all([
    mainRun,
    ...open.map((p, i) => (i < CI_CAP ? prCi(p.headSha).catch((): Ci => "unknown") : Promise.resolve<Ci>("unknown"))),
  ]);
  open.forEach((p, i) => (p.ci = openCi[i] as Ci));
  return { prs, issues, mainCi: main?.ci ?? "unknown", mainCiUrl: main?.url ?? null };
}

export async function readRaw({ root = process.cwd(), token = process.env.GITHUB_TOKEN, now = Date.now() } = {}): Promise<Raw> {
  const files = readRepoFiles(root);
  // A checkout without milestones.toml is broken, not GitHub being down: fail the build loudly.
  if (!files["specs/milestones.toml"]) throw new Error(`specs/milestones.toml not found under ${root}`);
  const api: Api = { token: Boolean(token), calls: 0, remaining: null, limit: null, error: null };
  const raw: Raw = {
    repo: REPO,
    sha: process.env.GIT_COMMIT ?? "unknown",
    fetchedAt: new Date(now).toISOString(),
    files,
    stop: existsSync(join(root, "STOP")),
    prs: [],
    issues: [],
    prsKnown: false,
    mainCi: "unknown",
    mainCiUrl: null,
    api,
  };
  if (!token) return raw;
  try {
    Object.assign(raw, await readGitHub(api, token), { prsKnown: true });
  } catch (e) {
    api.error = e instanceof Error ? e.message : String(e);
  }
  return raw;
}
