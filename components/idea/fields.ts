// Mirrors lib/ideas/contract.ts (idea-create-api): six nullable fields, and the saved version shape.
export const FIELDS = [
  { name: "title", label: "Title", long: false },
  { name: "description", label: "Description", long: true },
  { name: "audience", label: "Audience", long: true },
  { name: "problem", label: "Problem", long: true },
  { name: "workflow", label: "Workflow", long: true },
  { name: "constraints", label: "Constraints", long: true },
] as const;

export type FieldName = (typeof FIELDS)[number]["name"];
export type Fields = Record<FieldName, string | null>;
export type Version = Fields & {
  ideaId: string;
  versionId: string;
  parentId: string | null;
  x: number;
  y: number;
  z: number;
  neighborIds: string[];
  corpusVersion: string;
  createdAt: string;
};

// The form edits strings; a blank field is sent as null, never as an invented value.
export const toForm = (f: Partial<Fields>) =>
  Object.fromEntries(FIELDS.map(({ name }) => [name, f[name] ?? ""])) as Record<FieldName, string>;
export const fromForm = (form: Record<FieldName, string>) =>
  Object.fromEntries(FIELDS.map(({ name }) => [name, form[name].trim() || null])) as Fields;
export const hasText = (f: Fields) => Object.values(f).some((v) => v !== null);

export const latest = (versions: Version[]) =>
  versions.reduce<Version | null>((a, v) => (!a || Date.parse(v.createdAt) > Date.parse(a.createdAt) ? v : a), null);

// What the galaxy draws: every saved idea as a star, the latest active, its neighbors highlighted.
export const galaxyState = (versions: Version[]) => {
  const active = latest(versions);
  return {
    ideaStars: versions.map(({ versionId, x, y, z }) => ({ versionId, x, y, z })),
    activeIdeaVersionId: active?.versionId ?? null,
    highlightedIds: active?.neighborIds ?? [],
  };
};
