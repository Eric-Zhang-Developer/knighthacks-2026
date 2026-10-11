import { FIELDS, type Fields } from "@/components/idea/fields";

type InferredRelevance = { text: string; label: "inferred"; sourceIds: string[] };
export type MentorNews = {
  query: string; asOf: string; windowStart: string; model: string;
  items: { claim: { text: string; label: "supported"; sourceIds: string[] };
    source: { id: string; title: string; url: string }; publishedAt: string; relevance?: string | InferredRelevance }[];
  limitations: string[];
};

const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
const dated = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
export function readNewsData(value: unknown): MentorNews | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (typeof data.query !== "string" || !dated(data.asOf) || !dated(data.windowStart) || typeof data.model !== "string" ||
    !Array.isArray(data.items) || !strings(data.limitations)) return null;
  const items: MentorNews["items"] = [];
  for (const raw of data.items) {
    if (!raw || typeof raw !== "object") return null;
    const item = raw as Record<string, unknown>, claim = item.claim as Record<string, unknown> | null,
      source = item.source as Record<string, unknown> | null, relevance = item.relevance;
    if (!claim || claim.label !== "supported" || typeof claim.text !== "string" || !strings(claim.sourceIds) ||
      !source || typeof source.id !== "string" || typeof source.title !== "string" || typeof source.url !== "string" || !dated(item.publishedAt)) return null;
    if (relevance !== undefined && typeof relevance !== "string" &&
      (!relevance || typeof relevance !== "object" || (relevance as Record<string, unknown>).label !== "inferred" ||
        typeof (relevance as Record<string, unknown>).text !== "string" || !strings((relevance as Record<string, unknown>).sourceIds))) return null;
    items.push(item as MentorNews["items"][number]);
  }
  return { query: data.query, asOf: data.asOf, windowStart: data.windowStart, model: data.model,
    items, limitations: [...data.limitations] };
}

export function readFields(value: unknown): Fields {
  if (!value || typeof value !== "object") throw new Error("The idea response was incomplete. Your message is kept.");
  const source = value as Record<string, unknown>;
  const fields = Object.fromEntries(FIELDS.map(({ name }) => {
    const field = source[name];
    if (field !== null && typeof field !== "string") throw new Error("The idea response was incomplete. Your message is kept.");
    return [name, field];
  })) as Fields;
  if (!Object.values(fields).some((v) => v?.trim())) throw new Error("There is not enough detail to propose an idea yet.");
  return fields;
}

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}

export async function toolIdentity(sessionId: string, turnId: number, tool: string, args: unknown) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${sessionId}:${turnId}:${tool}:${canonical(args)}`));
  return Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("");
}

export async function request(path: string, body?: unknown, signal?: AbortSignal, headers?: Record<string, string>) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body ?? {}), signal });
  const data = await response.json().catch(() => null);
  if (response.status === 429 && path === "/api/mentor/session") throw new Error("Live conversation is temporarily unavailable. Try again later; your draft is kept and typing remains available.");
  if (!response.ok) throw new Error(response.status === 404 || response.status === 503 ? "This service is not available yet. Your conversation is kept; you can continue typing." : typeof data?.error === "string" ? data.error : "That request did not finish. Your conversation is kept.");
  return data;
}
