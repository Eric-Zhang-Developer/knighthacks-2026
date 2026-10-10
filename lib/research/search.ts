import "next/dist/compiled/server-only";
import { fromGitHub, fromHuggingFace, type Found, type Source } from "./contract";

// Only the public search endpoints; nothing is cloned, installed, downloaded or executed (V3 F13). Tests point both at
// a recorded-response server with RESEARCH_SEARCH_BASE, honoured under the same opt-in as the AI fixtures and never
// on Vercel.
function bases() {
  const base = process.env.RESEARCH_SEARCH_BASE;
  const allowed = (process.env.NODE_ENV === "test" || process.env.AI_STUB_ALLOW === "1") && !process.env.VERCEL;
  return base && allowed ? { github: `${base}/github`, hf: `${base}/hf` } : { github: "https://api.github.com", hf: "https://huggingface.co" };
}
const HF_ENDPOINT = { "hf-model": "models", "hf-space": "spaces", "hf-dataset": "datasets" } as const;

type Result = { found: Found[] } | { status: number };
async function get(url: string, headers: Record<string, string>): Promise<{ status: number; body?: unknown }> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000), cache: "no-store" });
    return res.ok ? { status: res.status, body: await res.json() } : { status: res.status };
  } catch {
    return { status: 0 }; // network error or timeout
  }
}

export async function search(source: Source, query: string): Promise<Result> {
  const { github, hf } = bases();
  const q = encodeURIComponent(query);
  if (source === "github") {
    const r = await get(`${github}/search/repositories?q=${q}&per_page=5`, { Accept: "application/vnd.github+json", "User-Agent": "uncharted-knighthacks" });
    return r.body !== undefined ? { found: fromGitHub(r.body) } : { status: r.status };
  }
  const token = process.env.HF_TOKEN;
  const r = await get(`${hf}/api/${HF_ENDPOINT[source]}?search=${q}&limit=5`, token ? { Authorization: `Bearer ${token}` } : {});
  return r.body !== undefined ? { found: fromHuggingFace(source, r.body) } : { status: r.status };
}
