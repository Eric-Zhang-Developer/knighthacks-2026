import type { Claim } from "@/lib/ai/claims";
export class EvidenceError extends Error { constructor(readonly status: number, message: string) { super(message); } }
export type Item = { id: string; claim: Claim; about: "problem" | "solution";
  source: { title: string; domain: string; url: string | null }; publishedAt: string | null; eventDate: string | null; relevance: Claim };
export type Evidence = { versionId: string; problem: string; items: Item[]; searchedAt: string; model: string };
const month = "(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)";
const date = new RegExp(`\\b(?:\\d{4}-\\d{2}-\\d{2}|${month}\\.? (?:\\d{1,2}(?:st|nd|rd|th)?,? )?\\d{4}|\\d{1,2} ${month}\\.? \\d{4}|(?:19|20)\\d{2})\\b`, "i");
export function eventDate(text: string): string | null { return text.match(date)?.[0] ?? null; }
export function orderItems(items: Item[]) {
  return items.sort((a, b) => Number(a.about === "solution") - Number(b.about === "solution") ||
    (b.publishedAt ? Date.parse(b.publishedAt) : -Infinity) - (a.publishedAt ? Date.parse(a.publishedAt) : -Infinity)).slice(0, 8);
}
