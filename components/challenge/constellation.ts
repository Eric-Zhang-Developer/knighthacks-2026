import type { Assumption, Kind } from "./change-mind";

// Four fixed cluster centres (percent of the map box), one per kind; the idea sits at 50,50.
const CLUSTERS: Record<Kind, { x: number; y: number }> = {
  need: { x: 25, y: 28 }, data: { x: 75, y: 28 }, feasibility: { x: 25, y: 76 }, differentiation: { x: 75, y: 76 },
};

// Node positions spread side by side inside their cluster, and edges between assumptions sharing a cited project.
export function layout(items: Assumption[]) {
  const counts = new Map<Kind, number>();
  const index = items.map((a) => {
    const n = counts.get(a.kind) ?? 0;
    counts.set(a.kind, n + 1);
    return n;
  });
  const nodes = items.map((a, i) => {
    const total = counts.get(a.kind)!, c = CLUSTERS[a.kind];
    return { kind: a.kind, x: c.x + (index[i] - (total - 1) / 2) * 14, y: c.y };
  });
  const edges: [number, number][] = [];
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++)
      if (items[i].assumption.sourceIds.some((id) => items[j].assumption.sourceIds.includes(id))) edges.push([i, j]);
  return { nodes, edges, clusters: CLUSTERS };
}
