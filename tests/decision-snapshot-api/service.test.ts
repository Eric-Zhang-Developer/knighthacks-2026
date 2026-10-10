import { beforeEach, expect, test, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const { execute, createEvidence } = vi.hoisted(() => ({ execute: vi.fn(), createEvidence: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: () => ({ execute }) }));
vi.mock("@/lib/evidence/service", () => ({ createEvidence }));
import { EvidenceError } from "@/lib/evidence/contract";
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
test("a choice waits for the selected version's default evidence batch before freezing", async () => {
  let finish!: () => void;
  createEvidence.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
  const pending = createSnapshot("workspace", "branch-version");
  expect(createEvidence).toHaveBeenCalledWith("workspace", "branch-version", false);
  expect(execute).not.toHaveBeenCalled();
  finish();
  await pending;
  expect(execute).toHaveBeenCalledTimes(1);
});
test.each([404, 502, 503])("evidence failure %s prevents an incomplete snapshot from being inserted", async (status) => {
  createEvidence.mockRejectedValue(new EvidenceError(status, "Evidence unavailable"));
  await expect(createSnapshot("workspace", "branch-version")).rejects.toMatchObject({ status });
  expect(execute).not.toHaveBeenCalled();
});
