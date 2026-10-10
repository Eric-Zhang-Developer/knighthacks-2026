import "next/dist/compiled/server-only";
export type Claim = { text: string; label: "supported" | "inferred" | "unverified"; sourceIds: string[] };
/** Source membership checks provenance only, not whether a source proves the text. */
export function checkClaims(claims: readonly Claim[], sourceIds: Iterable<string>): Claim[] {
  const known = new Set(sourceIds);
  return claims.map((claim) => ({ ...claim, sourceIds: [...claim.sourceIds], label:
    claim.label === "supported" && (!claim.sourceIds.length || claim.sourceIds.some((id) => !known.has(id)))
      ? "unverified" : claim.label,
  }));
}
