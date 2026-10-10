import { beforeEach, expect, test, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: () => ({ execute }) }));
import { createSnapshot, getSnapshot } from "@/lib/snapshots/service";
const data = { versionId: "version", idea: { title: "Stored", description: null, problem: null, workflow: null, constraints: null }, audience: null, nearestAlternatives: [{ projectId: "missing", title: null, url: null }], whatDiffers: [], mainUncertainty: null, nextTest: null };
beforeEach(() => { vi.resetAllMocks(); execute.mockResolvedValue({ rows: [{ data }] }); });
test("every choice gets a fresh ID and returns exactly database-frozen data", async () => {
  const first = await createSnapshot("workspace", "version"), second = await createSnapshot("workspace", "version");
  expect(first.snapshotId).not.toBe(second.snapshotId); expect(first.data).toEqual(data);
  expect(execute).toHaveBeenCalledTimes(2);
  const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
  expect(query.params).toEqual([first.snapshotId, "version", "workspace"]);
  expect(query.sql).not.toMatch(/\bupdate\b|\bdelete\b/i);
  // Privacy boundary: no whole-row serialization, answers, questions or votes.
  expect(query.sql).not.toMatch(/row_to_json|to_jsonb\(|"answer"|"question"|"votes"|"notes"/);
});
test("read returns persisted JSON unchanged and never joins mutable source tables", async () => {
  const serialized = JSON.stringify(data);
  expect(JSON.stringify(await getSnapshot("workspace", "snapshot"))).toBe(serialized);
  const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
  expect(query.params).toEqual(["snapshot", "workspace"]); expect(query.sql).not.toMatch(/join/i);
});
test("unknown and foreign IDs are indistinguishable and never return a snapshot", async () => {
  execute.mockResolvedValue({ rows: [] });
  await expect(createSnapshot("other", "version")).rejects.toMatchObject({ status: 404 });
  await expect(getSnapshot("other", "snapshot")).rejects.toMatchObject({ status: 404 });
});
