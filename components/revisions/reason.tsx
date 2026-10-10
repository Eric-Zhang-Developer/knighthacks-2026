import { ClaimBadge } from "@/components/ui/ClaimBadge";
import type { ClaimSuggestion } from "./trail";

export function RevisionReason({ reason }: { reason: ClaimSuggestion["reason"] }) {
  const claim = typeof reason === "string" ? { text: reason, label: "inferred" as const } : reason;
  return <><ClaimBadge label={claim.label} /> {claim.text}</>;
}
