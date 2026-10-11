import { canonical } from "./protocol";
import type { Candidate } from "./candidates";

export type Command =
  | { kind: "navigate"; destination: "explore" | "idea" | "decide" | "plan" }
  | { kind: "show" | "prepare-save" | "confirm-save"; index: number }
  | { kind: "end" | "cancel" | "minimize" | "show-ideas" | "team" };

const numbers: Record<string, number> = { one: 1, first: 1, two: 2, second: 2, three: 3, third: 3 };
const ordinal = "(one|two|three|first|second|third|[1-9][0-9]?)";

// A bounded UI command vocabulary, not a model-powered mutation tool. Whole
// utterances only: quoted examples, negations and arbitrary prose do not match.
export function readCommand(text: string): Command | null {
  const value = text.toLowerCase().trim().replace(/[.!?]+$/, "").replace(/^please /, "").replace(/ please$/, "").replace(/\s+/g, " ");
  if (/^(end|stop) (the |our )?(call|conversation|voice session)$/.test(value)) return { kind: "end" };
  if (/^(cancel|cancel (the )?save|never mind|nevermind)$/.test(value)) return { kind: "cancel" };
  if (/^(minimize|hide) (the )?(call|conversation)$/.test(value)) return { kind: "minimize" };
  if (/^(show|open) (my |the )?(ideas|candidates|idea cards)$/.test(value)) return { kind: "show-ideas" };
  if (/^(show|open) (the )?(team|teammate menu)$/.test(value)) return { kind: "team" };
  const destination = value.match(/^(?:show|open|go to|take me to) (?:the )?(map|explore|idea|evidence|decide|decision|plan)$/)?.[1];
  if (destination) return { kind: "navigate", destination: ({ map: "explore", evidence: "idea", decision: "decide" } as Record<string, "explore" | "idea" | "decide">)[destination] ?? destination as "explore" | "idea" | "decide" | "plan" };
  for (const [kind, prefix] of [["confirm-save", "confirm save"], ["prepare-save", "(?:save|choose|proceed with)"], ["show", "(?:show|open|discuss)"]] as const) {
    const match = value.match(new RegExp(`^${prefix} (?:idea|candidate) ${ordinal}$`));
    if (match) return { kind, index: (numbers[match[1]] ?? Number(match[1])) - 1 };
  }
  return null;
}

export type PendingSave = { candidate: Candidate; index: number; expiresAt: number };
export function confirmedCandidate(pending: PendingSave | null, candidates: Candidate[], index: number, now: number): Candidate | null {
  if (!pending || index !== pending.index || now >= pending.expiresAt) return null;
  const current = candidates[index];
  if (!current || current.versionId || current.id !== pending.candidate.id || current.saveKey !== pending.candidate.saveKey || canonical(current.fields) !== canonical(pending.candidate.fields)) return null;
  return pending.candidate;
}
