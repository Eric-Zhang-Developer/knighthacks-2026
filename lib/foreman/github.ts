import "next/dist/compiled/server-only";
import type { Ci, PR, Raw } from "./board";

export const REPO = "Eric-Zhang-Developer/knighthacks-2026";
// GitHub allows 60 unauthenticated API calls an hour; a token (read-only, server-only) raises that to 5000.
const TOKEN = process.env.GITHUB_TOKEN;
export const REVALIDATE = TOKEN ? 60 : 600;

async function api<T>(path: string): Promise<T> {
  return (await apiWithDate<T>(path)).data;
}

// GitHub's Date header survives Next's data cache, so the page can say how old the cached data really is.
async function apiWithDate<T>(path: string): Promise<{ data: T; date: string }> {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    headers: { Accept: "application/vnd.github+json", ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) },
    next: { revalidate: REVALIDATE },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status} on ${path}${res.status === 403 ? " (rate limit?)" : ""}`);
  return { data: (await res.json()) as T, date: new Date(res.headers.get("date") ?? Date.now()).toISOString() };
}

async function allPulls(): Promise<GhPR[]> {
  const out: GhPR[] = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await api<GhPR[]>(`/pulls?state=all&sort=created&direction=desc&per_page=100&page=${page}`);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

// Raw files by commit SHA never change, so they're cached for good and don't count against the API limit.
async function file(sha: string, path: string): Promise<string> {
  const res = await fetch(`https://raw.githubusercontent.com/${REPO}/${sha}/${path}`, { cache: "force-cache" });
  if (!res.ok) throw new Error(`raw ${res.status} on ${path}`);
  return res.text();
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
type GhRuns = { check_runs: { status: string; conclusion: string | null; name: string }[] };

async function ci(sha: string): Promise<Ci> {
  const { check_runs } = await api<GhRuns>(`/commits/${sha}/check-runs?per_page=100`);
  if (!check_runs.length) return "none";
  if (check_runs.some((r) => ["failure", "timed_out", "cancelled", "action_required"].includes(r.conclusion ?? ""))) return "failure";
  if (check_runs.some((r) => r.status !== "completed")) return "pending";
  return "success";
}

export async function readRaw(): Promise<Raw> {
  const { data: head, date } = await apiWithDate<{ sha: string }>("/commits/main");
  const tree = await api<{ tree: { path: string; type: string }[] }>(`/git/trees/${head.sha}?recursive=1`);
  const paths = tree.tree.filter((t) => t.type === "blob").map((t) => t.path);
  const wanted = paths.filter(
    (p) =>
      p === "specs/milestones.toml" ||
      /^specs\/(features|shipped\/[^/]+)\/[^/_][^/]*\/spec\.md$/.test(p) ||
      /^changes\/[^/]+\.md$/.test(p),
  );
  const [texts, pages, issues] = await Promise.all([
    Promise.all(wanted.map((p) => file(head.sha, p))),
    allPulls(),
    api<GhIssue[]>("/issues?state=open&per_page=100"),
  ]);
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
  const open = prs.filter((p) => p.state === "open");
  const [mainCi, ...openCi] = await Promise.all([ci(head.sha), ...open.map((p) => ci(p.headSha).catch((): Ci => "none"))]);
  open.forEach((p, i) => (p.ci = openCi[i]));
  return {
    repo: REPO,
    sha: head.sha,
    fetchedAt: date,
    files: Object.fromEntries(wanted.map((p, i) => [p, texts[i]])),
    paths,
    prs,
    issues: issues
      .filter((i) => !i.pull_request)
      .map((i) => ({ number: i.number, title: i.title, url: i.html_url, createdAt: i.created_at, labels: i.labels.map((l) => l.name) })),
    mainCi,
  };
}
