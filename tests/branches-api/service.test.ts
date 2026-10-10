import { beforeEach, expect, test, vi } from "vitest";
const { execute, generate, embed, acceptRevision } = vi.hoisted(() => ({
  execute: vi.fn(), generate: vi.fn(), embed: vi.fn(), acceptRevision: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: () => ({ execute }) }));
vi.mock("@/lib/ai/generate", () => ({ generate }));
vi.mock("@/lib/search/embed", () => ({ embed }));
vi.mock("@/lib/revisions/service", () => ({ accept: acceptRevision }));
import { suggest, accept, manual } from "@/lib/branches/service";
const parent = { ideaId: "idea", versionId: "version", parentId: null, title: "Meal planning", description: null,
  audience: null, problem: null, workflow: null, constraints: null, createdAt: "2026-10-10T00:00:00Z" };
beforeEach(() => { vi.resetAllMocks(); execute.mockResolvedValue({ rows: [parent] }); });
test("unknown/foreign versions cannot invoke generation or embedding", async () => {
  execute.mockResolvedValue({ rows: [] });
  await expect(suggest("other", "version")).rejects.toMatchObject({ status: 404 });
  await expect(manual("other", "version", { title: "Edit" })).rejects.toMatchObject({ status: 404 });
  await expect(accept("other", "direction")).rejects.toMatchObject({ status: 404 });
  expect(generate).not.toHaveBeenCalled(); expect(embed).not.toHaveBeenCalled(); expect(acceptRevision).not.toHaveBeenCalled();
});
test("duplicate directions or provider failure do not store proposals", async () => {
  const d = { title: "A direction", field: "workflow", change: "A new workflow" };
  generate.mockResolvedValueOnce({ directions: [d, d] }).mockRejectedValueOnce(new Error("provider secret"));
  await expect(suggest("workspace", "version")).rejects.toMatchObject({ status: 502 });
  await expect(suggest("workspace", "version")).rejects.toMatchObject({ status: 502 });
  expect(execute).toHaveBeenCalledTimes(2);
});
test("no-op or empty manual versions never invoke embedding or insert", async () => {
  await expect(manual("workspace", "version", { title: parent.title })).rejects.toMatchObject({ status: 400 });
  await expect(manual("workspace", "version", { title: null })).rejects.toMatchObject({ status: 400 });
  expect(embed).not.toHaveBeenCalled(); expect(execute).toHaveBeenCalledTimes(2);
});
test("invalid vectors cannot create manual versions", async () => {
  for (const vector of [[], Array(1024).fill(0), Array(1024).fill(NaN)]) {
    embed.mockResolvedValueOnce(vector);
    await expect(manual("workspace", "version", { title: "New title" })).rejects.toMatchObject({ status: 503 });
  }
  expect(execute).toHaveBeenCalledTimes(3);
});
