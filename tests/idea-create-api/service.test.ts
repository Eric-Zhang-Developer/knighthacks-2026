import { beforeEach, expect, test, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
const { execute, embed, neighbors } = vi.hoisted(() => ({ execute: vi.fn(), embed: vi.fn(), neighbors: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: () => ({ execute }) }));
vi.mock("@/lib/search/embed", () => ({ embed }));
vi.mock("@/lib/search/neighbors", () => ({ neighbors }));
import { createIdea, listIdeas } from "@/lib/ideas/service";
const fields = { title: "Test idea", description: null, audience: null, problem: null, workflow: null, constraints: null };
const ids = ["a", "b", "c", "d", "e"];
const points = ids.map((id, i) => ({ id, x: i, y: 2 * i, z: -i, corpusVersion: "test-corpus" }));
const row = { ...fields, ideaId: "idea", versionId: "version", parentId: null, x: 2, y: 4, z: -2, neighborIds: ids, corpusVersion: "test-corpus", createdAt: "2026-10-10T00:00:00Z" };
const query = (index: number) => new PgDialect().sqlToQuery(execute.mock.calls[index][0] as SQL);
beforeEach(() => {
  vi.resetAllMocks();
  embed.mockResolvedValue([1, ...Array(1023).fill(0)]);
  neighbors.mockResolvedValue(ids.map((id) => ({ id, similarity: 0.9 })));
});
test("v1 uses five cosine neighbors and their stored centroid in one atomic insert", async () => {
  execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: points }).mockResolvedValueOnce({ rows: [row] });
  const result = await createIdea("workspace-a", "retry-key", fields);
  expect(result).toEqual({ created: true, version: { ...row, createdAt: "2026-10-10T00:00:00.000Z" } });
  expect(embed).toHaveBeenCalledWith("title: Test idea");
  expect(neighbors).toHaveBeenCalledWith(await embed.mock.results[0].value, {}, 5);
  const insert = query(2);
  expect(insert.sql).toMatch(/with new_idea as/);
  expect(insert.sql).toMatch(/on conflict \(workspace_id, idempotency_key\) do nothing/);
  expect(insert.sql).toMatch(/from new_idea returning \*/);
  expect(insert.sql).not.toMatch(/\bupdate\b/i);
  expect(insert.params).toEqual(expect.arrayContaining(["workspace-a", "retry-key", 2, 4, -2, JSON.stringify(ids), "test-corpus"]));
  expect(query(1).params).toEqual([JSON.stringify(ids)]);
});
test("retry returns original v1 before another embedding or insert", async () => {
  execute.mockResolvedValueOnce({ rows: [row] });
  expect((await createIdea("workspace-a", "same", { ...fields, title: "different" })).created).toBe(false);
  expect(execute).toHaveBeenCalledTimes(1); expect(embed).not.toHaveBeenCalled();
  expect(query(0).params).toEqual(["workspace-a", "same"]);
  expect(query(0).sql).toContain("v.parent_id is null");
});
test("concurrent insert loser reads committed winner in a new statement", async () => {
  execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: points }).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [row] });
  expect(await createIdea("workspace-a", "same", fields)).toMatchObject({ created: false, version: { versionId: "version" } });
  expect(execute).toHaveBeenCalledTimes(4);
  expect(query(3).params).toEqual(["workspace-a", "same"]);
  expect(query(3).sql).toMatch(/^select/);
});
test.each([
  [], points.slice(0, 4), points.map((p, i) => i ? p : { ...p, x: NaN }),
  points.map((p, i) => i ? p : { ...p, corpusVersion: "other" }),
].map((bad) => ({ bad })))("missing or inconsistent corpus coordinates never create a version (%#)", async ({ bad }) => {
  execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: bad });
  await expect(createIdea("workspace-a", "key", fields)).rejects.toMatchObject({ status: 503 });
  expect(execute).toHaveBeenCalledTimes(2);
});
test("insufficient neighbors and invalid vectors fail before writes", async () => {
  execute.mockResolvedValue({ rows: [] });
  neighbors.mockResolvedValue([{ id: "a" }]);
  await expect(createIdea("workspace-a", "key", fields)).rejects.toMatchObject({ status: 503 });
  expect(execute).toHaveBeenCalledTimes(1);
  embed.mockResolvedValue(Array(1024).fill(0));
  await expect(createIdea("workspace-a", "key", fields)).rejects.toMatchObject({ status: 503 });
  expect(neighbors).toHaveBeenCalledTimes(1);
});
test("GET filters the authenticated workspace and selects latest saved version", async () => {
  execute.mockResolvedValueOnce({ rows: [row] });
  expect(await listIdeas("workspace-b")).toHaveLength(1);
  expect(query(0).params).toEqual(["workspace-b"]);
  expect(query(0).sql).toContain("where i.workspace_id =");
  expect(query(0).sql).toContain("v.created_at desc, v.id desc");
});
