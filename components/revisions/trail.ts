// Shapes from idea-revisions-api (lib/revisions/contract.ts) and idea-create-api's version.
export type Suggestion = { id: string; field: "audience" | "problem" | "workflow" | "constraints"; change: string; reason: string };
export type Version = {
  ideaId: string;
  versionId: string;
  parentId: string | null;
  title: string | null;
  description: string | null;
  audience: string | null;
  problem: string | null;
  workflow: string | null;
  constraints: string | null;
  x: number;
  y: number;
  z: number;
  neighborIds: string[];
  createdAt: string;
};
export type Star = { versionId: string; x: number; y: number; z: number };

// The accepted version takes the place of the one it revised, so each idea stays one star. Mid-animation the
// star already carries the new ID, so either ID matches.
export const replaceStar = (stars: Star[], ids: string[], to: Star) =>
  stars.some((s) => ids.includes(s.versionId))
    ? stars.map((s) => (ids.includes(s.versionId) ? to : s))
    : [...stars, to];

// Linear position between two versions, t in [0, 1], for the move animation.
export const lerpStar = (from: Star, to: Star, t: number): Star => ({
  versionId: to.versionId,
  x: from.x + (to.x - from.x) * t,
  y: from.y + (to.y - from.y) * t,
  z: from.z + (to.z - from.z) * t,
});

// 1-based version numbers along the trail (oldest first), for labels.
export const versionNumber = (trail: Version[], versionId: string) => trail.findIndex((v) => v.versionId === versionId) + 1;
