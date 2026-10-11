import { z } from "zod";

// Groups by the year a project was started (Devpost's "started this project" time, `year` in stars.json).
export const ERAS = [
  { id: "through-2022", label: "Started through 2022", has: (y: number | null) => y !== null && y <= 2022 },
  { id: "2023-2024", label: "2023–2024", has: (y: number | null) => y !== null && y >= 2023 && y <= 2024 },
  { id: "2025-on", label: "2025 onward", has: (y: number | null) => y !== null && y >= 2025 },
  { id: "unknown", label: "Start date unknown", has: (y: number | null) => y === null },
] as const;

export type DevTools = "reported" | "reported_non_use" | "unknown";
export type Row = { id: string; label: string; count: number; tools: Record<DevTools, number> | null };

// Only the field this board reads from public/classify/classes.json (corpus-classify), for this corpus only.
const Classes = z.object({
  corpus_version: z.string(),
  projects: z.record(z.string(), z.object({ dev_tools: z.enum(["reported", "reported_non_use", "unknown"]) })),
});
export type ToolUse = Map<string, DevTools>;

export function parseToolUse(json: unknown, corpusVersion: string): ToolUse | null {
  const parsed = Classes.safeParse(json);
  if (!parsed.success || parsed.data.corpus_version !== corpusVersion) return null;
  return new Map(Object.entries(parsed.data.projects).map(([id, p]) => [id, p.dev_tools]));
}

// One row per era, counted from the stars. Tool use is null when classes.json isn't loaded; a star it doesn't list
// counts as unknown, never as "didn't use".
export function eraRows(stars: { id: string; year?: number | null }[], tools: ToolUse | null): Row[] {
  return ERAS.map((era) => {
    const inEra = stars.filter((s) => era.has(s.year ?? null));
    const counted: Record<DevTools, number> = { reported: 0, reported_non_use: 0, unknown: 0 };
    for (const s of inEra) counted[tools?.get(s.id) ?? "unknown"]++;
    return { id: era.id, label: era.label, count: inEra.length, tools: tools ? counted : null };
  });
}

// Context only, each checked against its source on 2026-10-10 (see the decision file).
export const RELEASES = [
  { date: "2021-06-29", label: "GitHub Copilot technical preview", href: "https://github.blog/news-insights/product-news/introducing-github-copilot-ai-pair-programmer/" },
  { date: "2022-11-30", label: "ChatGPT", href: "https://openai.com/index/chatgpt/" },
  { date: "2025-02-24", label: "Claude Code research preview", href: "https://www.anthropic.com/news/claude-3-7-sonnet" },
] as const;
