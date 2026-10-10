import type { Version } from "@/components/revisions/trail";

// Shape from compare-api (lib/compare/contract.ts).
export type Claim = { text: string; label: "supported" | "inferred" | "unverified"; sourceIds: string[] };
export type Comparison = {
  criteria: { name: string; perVersion: { versionId: string; reason: Claim; uncertainty: string }[] }[];
};

export const MIN = 2;
export const MAX = 3;

// Toggles a version in the selection, never past three.
export const toggle = (selected: string[], id: string) =>
  selected.includes(id) ? selected.filter((x) => x !== id) : selected.length < MAX ? [...selected, id] : selected;

// Columns follow trail order, so "Version 2" means the same thing here as in the Revisions trail.
export const columns = (trail: Version[], selected: string[]) =>
  trail.map((v, i) => ({ version: v, label: `Version ${i + 1}` })).filter((c) => selected.includes(c.version.versionId));

export const cell = (c: Comparison["criteria"][number], versionId: string) => c.perVersion.find((p) => p.versionId === versionId);
