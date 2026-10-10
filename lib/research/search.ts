import "next/dist/compiled/server-only";
import { fromGitHub, fromHuggingFace, SOURCES, type Found, type Source } from "./contract";

// Only the public search endpoints; nothing is cloned, installed, downloaded or executed (V3 F13). Tests point both at
// a recorded-response server with RESEARCH_SEARCH_BASE, honoured under the same opt-in as the AI fixtures and never
// on Vercel.
function bases() {
  const base = process.env.RESEARCH_SEARCH_BASE;
  const allowed = (process.env.NODE_ENV === "test" || process.env.AI_STUB_ALLOW === "1") && !process.env.VERCEL;
  return base && allowed ? { github: `${base}/github`, hf: `${base}/hf` } : { github: "https://api.github.com", hf: "https://huggingface.co" };
}
const HF_ENDPOINT = { "hf-model": "models", "hf-space": "spaces", "hf-dataset": "datasets" } as const;

// Hub search matches repository IDs, not prose. Prefer longer content terms without another model call.
const HF_STOP = new Set(["a", "an", "the", "and", "or", "for", "with", "from", "into", "using", "based", "on", "to", "of"]);
export function searchCalls(queries: string[]): { source: Source; q: string }[] {
  const seen = new Set<string>();
  return queries.flatMap((query) => {
    const terms = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_-]*/gu) ?? [])]
      .filter((term) => !HF_STOP.has(term)).sort((a, b) => b.length - a.length).slice(0, 2);
    return SOURCES.flatMap((source) => (source === "github" ? [query] : terms).map((q) => ({ source, q })));
  }).filter(({ source, q }) => {
    const key = `${source}:${q}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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
