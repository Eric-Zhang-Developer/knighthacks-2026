// Shape pinned by idea-scorecard-api (lib/scorecard/contract.ts): five criteria, each on its own; no total.
import type { ClaimLabel } from "@/components/ui";

export type Point = { text: string; label: ClaimLabel; sourceIds: string[] };
export type Criterion = { criterion: string; score: number | null; for: Point[]; against: Point[]; label: "supported" | "inferred"; note: string | null };
export type Scorecard = { id: string; versionId: string; criteria: Criterion[]; sources: { projectId: string; title: string; url: string }[]; createdAt: string };
export type View = { kind: "loading" | "empty" | "scoring" } | { kind: "failed"; error: string } | { kind: "ready"; card: Scorecard };

export const scoreText = (c: Criterion) => (c.score === null ? c.note ?? "evidence is insufficient" : `${c.score} out of 5`);
// A cited project is named by its card's title when the scorecard carries it, else shown as an unnamed project.
export const sourceTitle = (card: Scorecard, id: string) => card.sources.find((s) => s.projectId === id)?.title ?? "Cited project";
