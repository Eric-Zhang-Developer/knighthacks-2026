import { beforeEach, expect, test, vi } from "vitest";

const { execute, generate, getEvidence } = vi.hoisted(() => ({
  execute: vi.fn(), generate: vi.fn(), getEvidence: vi.fn(),
}));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: () => ({ execute }) }));
vi.mock("@/lib/ai/generate", () => ({ generate }));
vi.mock("@/lib/evidence/service", () => ({ getEvidence }));
vi.mock("@/lib/search/embed", () => ({ embed: vi.fn() }));

import { propose } from "@/lib/revisions/service";

const version = {
  ideaId: "idea", versionId: "version", parentId: null, title: "Meal map", description: null,
  audience: "Hackathon teams", problem: "Choosing food", workflow: "Compare nearby options", constraints: null,
  x: 0, y: 0, z: 0, neighborIds: ["project-1"], corpusVersion: "corpus", createdAt: new Date(0),
};
const evidence = [{
  projectId: "project-1", title: "Prior project", url: "https://example.test/project", excerpt: "Teams compare meals.",
  overlaps: [{ text: "Teams compare meals.", label: "supported", sourceIds: ["project-1"] }],
  differences: [{ text: "The saved idea focuses on nearby options.", label: "inferred", sourceIds: ["project-1"] }],
  uncertainty: { text: "Teams may not agree.", label: "unverified", sourceIds: [] },
}];

beforeEach(() => {
  vi.resetAllMocks();
  execute.mockResolvedValueOnce({ rows: [version] }).mockResolvedValue({ rows: [] });
  getEvidence.mockResolvedValue({ cards: evidence });
  generate.mockResolvedValue({ suggestions: [{ field: "workflow", change: "Vote on nearby options", reason: "This addresses the saved uncertainty." }] });
});

test("revision proposals receive the exact saved evidence with labels and provenance", async () => {
  await propose("workspace", "version", "The challenged assumption is team agreement.");
  expect(getEvidence).toHaveBeenCalledWith("workspace", "version");
  const prompt = generate.mock.calls[0][0].prompt.text as string;
  expect(prompt).toContain(JSON.stringify(evidence));
  expect(prompt).toContain("The challenged assumption is team agreement.");
  expect(prompt).toContain("never treat an inferred or unverified claim as a sourced fact");
});

test("foreign versions fail before evidence lookup or generation", async () => {
  execute.mockReset().mockResolvedValue({ rows: [] });
  await expect(propose("other", "version")).rejects.toMatchObject({ status: 404 });
  expect(getEvidence).not.toHaveBeenCalled();
  expect(generate).not.toHaveBeenCalled();
});
