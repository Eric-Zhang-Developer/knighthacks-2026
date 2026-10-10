import { ClaimBadge } from "@/components/ui/ClaimBadge";
import type { Claim } from "@/lib/ai/claims";

export function ChallengeRevisionReason({ reason }: { reason: string | Claim }) {
  const claim = typeof reason === "string" ? { text: reason, label: "inferred" as const } : reason;
  return <><ClaimBadge label={claim.label} /> {claim.text}</>;
}
