import { z } from "zod";
import type { Claim } from "@/lib/ai/claims";

export const SOURCES = ["github", "hf-model", "hf-space", "hf-dataset"] as const;
export type Source = (typeof SOURCES)[number];
export const KINDS = ["direct-alternative", "adjacent", "research", "building-block"] as const;
export type Kind = (typeof KINDS)[number];
export type Found = { id: string; source: Source; name: string; url: string; description: string | null;
  popularity: { metric: "stars" | "likes" | "downloads"; value: number } | null; updatedAt: string | null };
export type Item = Found & { kind: Kind; reason: Claim };
export type Research = { versionId: string; queries: string[]; items: Item[]; unavailable: { source: Source; status: number }[]; searchedAt: string };

export const MAX_ITEMS = 12;
export const queriesSchema = z.object({ queries: z.array(z.string().trim().min(1).max(80)).min(1).max(3) }).strict();
export const classifySchema = z.object({ items: z.array(z.object({
  id: z.string().max(300), kind: z.enum(KINDS),
  reason: z.object({ text: z.string().trim().min(1).max(300), label: z.enum(["supported", "inferred", "unverified"]), sourceIds: z.array(z.string().max(300)).max(6) }).strict(),
}).strict()) }).strict(); // unbounded: Gemini rejects maxItems 24, and extras are dropped by id anyway

const str = (v: unknown) => (typeof v === "string" ? v : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// Every field is copied from the API response as returned; missing stays null (V3 F13). Only a Hugging Face url is
// built, from its id, because search returns ids, not URLs.
export function fromGitHub(body: unknown): Found[] {
  const items = (body as { items?: unknown[] })?.items;
  return (Array.isArray(items) ? items : []).flatMap((r) => {
    const o = r as Record<string, unknown>, name = str(o.full_name), url = str(o.html_url);
    if (!name || !url) return [];
    const stars = num(o.stargazers_count);
    return [{ id: `github:${name}`, source: "github" as const, name, url, description: str(o.description),
      popularity: stars === null ? null : { metric: "stars" as const, value: stars }, updatedAt: str(o.updated_at) }];
  });
}
const HF_PATH: Record<Exclude<Source, "github">, string> = { "hf-model": "", "hf-space": "spaces/", "hf-dataset": "datasets/" };
export function fromHuggingFace(source: Exclude<Source, "github">, body: unknown): Found[] {
  return (Array.isArray(body) ? body : []).flatMap((r) => {
    const o = r as Record<string, unknown>, name = str(o.id);
    if (!name) return [];
    const likes = num(o.likes);
    return [{ id: `${source}:${name}`, source, name, url: `https://huggingface.co/${HF_PATH[source]}${name}`,
      description: str(o.description), popularity: likes === null ? null : { metric: "likes" as const, value: likes },
      updatedAt: str(o.lastModified) }];
  });
}

export function dedupe(found: Found[]): Found[] {
  const seen = new Set<string>();
  return found.filter((f) => !seen.has(f.url) && seen.add(f.url)).slice(0, MAX_ITEMS);
}

// Classifications for unknown ids are dropped; a model library or dataset is never proof the product exists (V3 F14);
// each reason cites exactly its item and is at most inferred. Ordered by kind.
export function classify(found: Found[], output: z.infer<typeof classifySchema>): Item[] {
  const byId = new Map(found.map((f) => [f.id, f]));
  const done = new Set<string>();
  const items = output.items.flatMap((c) => {
    const f = byId.get(c.id);
    if (!f || done.has(c.id)) return [];
    done.add(c.id);
    const kind: Kind = c.kind === "direct-alternative" && (f.source === "hf-model" || f.source === "hf-dataset") ? "building-block" : c.kind;
    const label = c.reason.label === "supported" ? "inferred" : c.reason.label;
    return [{ ...f, kind, reason: { text: c.reason.text, label, sourceIds: [f.id] } }];
  });
  return items.sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));
}

export class ResearchError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
