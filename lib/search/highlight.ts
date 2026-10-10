type Ids = { results: { id: string }[]; textMatches: { id: string }[] };

// The ids a search highlights: meaning results first, then title matches not already listed.
export function resultIds({ results, textMatches }: Ids): string[] {
  return [...new Set([...results, ...textMatches].map((r) => r.id))];
}
