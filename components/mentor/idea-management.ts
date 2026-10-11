import type { Version } from "@/components/idea/fields";

export type IdeaIntent = { kind: "add" } | { kind: "list" } | { kind: "select" | "delete"; title: string };
export const IDEA_INTENT = "idea:intent";
export const IDEA_SELECTED = "idea:selected";
export const IDEA_RESULT = "idea:result";

// Only whole user utterances enter here, never assistant messages or tool output.
export function readIdeaIntent(text: string): IdeaIntent | null {
  const value = text.trim().replace(/[.!?]+$/, "").replace(/^please\s+/i, "").replace(/\s+/g, " ");
  if (/^(add|start) (another|a new) idea$/i.test(value)) return { kind: "add" };
  if (/^(list|show|open) (my |the )?saved ideas$/i.test(value)) return { kind: "list" };
  const match = value.match(/^(select|delete) saved idea (.{1,200})$/i);
  return match ? { kind: match[1].toLowerCase() as "select" | "delete", title: match[2] } : null;
}

export function resolveIdea(ideas: Version[], title: string): Version | null {
  const key = title.trim().toLocaleLowerCase();
  const matches = ideas.filter((idea) => idea.title?.trim().toLocaleLowerCase() === key);
  return matches.length === 1 ? matches[0] : null;
}

// The delete receipt must identify the reviewed idea, not merely return HTTP 200.
export function confirmsDeletion(receipt: unknown, ideaId: string): boolean {
  return typeof receipt === "object" && receipt !== null &&
    "ideaId" in receipt && receipt.ideaId === ideaId && "deleted" in receipt && receipt.deleted === true;
}

export function afterDeletion(ideas: Version[], deletedId: string, selectedId: string | null) {
  const remaining = ideas.filter((idea) => idea.ideaId !== deletedId);
  const selected = remaining.find((idea) => idea.ideaId === selectedId) ?? remaining[0] ?? null;
  return { remaining, selected };
}
