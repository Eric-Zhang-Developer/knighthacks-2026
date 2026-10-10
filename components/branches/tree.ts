import type { Version } from "@/components/revisions/trail";

export type Direction = { id: string; title: string; change: string };
type Star = { versionId: string; x: number; y: number; z: number };

// Rows of the trail by generation: a version's branches sit side by side in the row below it.
export function generations(trail: Version[]): Version[][] {
  const ids = new Set(trail.map((v) => v.versionId));
  const rows: Version[][] = [];
  let row = trail.filter((v) => !v.parentId || !ids.has(v.parentId));
  while (row.length) {
    rows.push(row);
    const parents = new Set(row.map((v) => v.versionId));
    row = trail.filter((v) => v.parentId && parents.has(v.parentId));
  }
  return rows;
}

// Versions that share a parent with another version are branches, and each gets its own star.
export function branchVersions(trail: Version[]): Version[] {
  const children = new Map<string, number>();
  for (const v of trail) if (v.parentId) children.set(v.parentId, (children.get(v.parentId) ?? 0) + 1);
  return trail.filter((v) => v.parentId && children.get(v.parentId)! > 1);
}

// Adds stars without moving or removing any that are already drawn.
export const addStars = (stars: Star[], add: Star[]) => [
  ...stars,
  ...add.filter((a) => !stars.some((s) => s.versionId === a.versionId)).map(({ versionId, x, y, z }) => ({ versionId, x, y, z })),
];
