import type { Fields } from "@/components/idea/fields";
import { canonical } from "./protocol";

export type Candidate = { id: string; saveKey: string; fields: Fields; versionId?: string };

// Exact re-delivery does not create another card or another save key. Never guess
// that two similarly titled alternatives are the same idea, or evict an older one.
export function addCandidate(current: Candidate[], fields: Fields, id: string): Candidate[] {
  if (current.some((candidate) => canonical(candidate.fields) === canonical(fields))) return current;
  return [...current, { id, saveKey: id, fields: { ...fields } }];
}
