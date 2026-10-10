// Everything the panel counts comes from stars.json, never typed in.
export function summarize(stars: { event?: string | null }[]) {
  const byEvent = new Map<string, number>();
  for (const s of stars) {
    const name = s.event ?? "Event unknown";
    byEvent.set(name, (byEvent.get(name) ?? 0) + 1);
  }
  return { count: stars.length, events: [...byEvent].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) };
}
