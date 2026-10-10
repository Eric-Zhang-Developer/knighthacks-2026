// Shape pinned by research-api (lib/research/contract.ts), and how the card groups and words it.
import type { ClaimLabel } from "@/components/ui";

export type Source = "github" | "hf-model" | "hf-space" | "hf-dataset";
export type Kind = "direct-alternative" | "adjacent" | "research" | "building-block";
export type Item = { id: string; source: Source; name: string; url: string; description: string | null;
  popularity: { metric: "stars" | "likes" | "downloads"; value: number } | null; updatedAt: string | null;
  kind: Kind; reason: { text: string; label: ClaimLabel; sourceIds: string[] } };
export type Research = { versionId: string; queries: string[]; items: Item[]; unavailable: { source: Source; status: number }[]; searchedAt: string };

export const GROUPS: { kind: Kind; title: string }[] = [
  { kind: "direct-alternative", title: "Direct alternatives: already let your user do this task" },
  { kind: "adjacent", title: "Adjacent work: related, but a different task" },
  { kind: "research", title: "Research: papers, benchmarks or studies" },
  { kind: "building-block", title: "Building blocks: models, datasets or libraries you could use" },
];
export const SOURCE_TEXT: Record<Source, string> = { github: "GitHub", "hf-model": "Hugging Face model", "hf-space": "Hugging Face Space", "hf-dataset": "Hugging Face dataset" };

// A model or dataset is never proof the product exists (V3 F14), whatever the response says.
export const kindOf = (i: Item): Kind => (i.kind === "direct-alternative" && (i.source === "hf-model" || i.source === "hf-dataset") ? "building-block" : i.kind);
export const popularity = (p: Item["popularity"]) => (p ? `${p.value.toLocaleString("en-US")} ${p.metric}` : null);
// Dates read as a day ("Mar 20, 2025"), in UTC so the day never shifts; text that isn't a date is shown as given.
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => (Number.isNaN(Date.parse(iso)) ? iso : new Date(iso).toLocaleString("en-US", { timeZone: "UTC", ...o }));
export const day = (iso: string) => fmt(iso, { dateStyle: "medium" });
export const moment = (iso: string) => `${fmt(iso, { dateStyle: "medium", timeStyle: "short" })} UTC`;
export const unavailableText = ({ source, status }: Research["unavailable"][number]) =>
  `${SOURCE_TEXT[source]} didn't answer (${status || "timed out"}); try again later`;
