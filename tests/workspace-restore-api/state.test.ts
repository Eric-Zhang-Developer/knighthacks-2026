import { beforeEach, expect, test, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: () => ({ execute }) }));
import { workspaceState, revokeListedShare } from "@/lib/workspace/state";
const workspace = "10000000-0000-4000-8000-000000000001";
const id = "10000000-0000-4000-8000-000000000002";
const at = "2026-10-10T16:00:00+00:00";
const empty = () => ({ ideas: [], challenges: [], snapshots: [], shares: [] });
const share = () => ({ id: "abcdef0123456789", snapshotId: id, createdAt: at, revokedAt: null });
beforeEach(() => vi.resetAllMocks());

test("empty and populated workspaces use a single bulk state query", async () => {
  for (const count of [0, 1, 50]) {
    execute.mockResolvedValue({ rows: [{ ...empty(), shares: Array.from({ length: count }, share) }] });
    const before = execute.mock.calls.length;
    const result = await workspaceState(workspace);
    expect(result.shares).toHaveLength(count);
    expect(execute.mock.calls.length - before).toBe(1);
    const query = new PgDialect().sqlToQuery(execute.mock.calls[before][0]);
    expect(query.params.every((value) => value === workspace)).toBe(true);
    expect(query.params.length).toBeGreaterThan(0);
  }
});

test("public projections strip capabilities and internal challenge fields", async () => {
  execute.mockResolvedValue({ rows: [{ ...empty(), token: "secret", shares: [{ ...share(), token_hash: "secret-full-hash", token: "secret" }],
    challenges: [{ sessionId: id, versionId: id, perspective: "judge", state: "awaiting", operationId: "secret", busyUntil: at,
      rounds: [{ round: 1, status: "awaiting", question: "What assumption needs testing?", assumption: "Users need this", source: { text: "Proposed test: ask a user", label: "unverified", sourceIds: [] }, answer: null, outcome: null, session_id: id }] }] }] });
  const result = await workspaceState(workspace);
  expect(JSON.stringify(result)).not.toContain("secret");
  expect(result.shares[0]).toEqual({ ...share(), createdAt: "2026-10-10T16:00:00.000Z" });
  expect(Object.keys(result.challenges[0]).sort()).toEqual(["perspective", "rounds", "sessionId", "state", "versionId"]);
  expect(result.challenges[0].rounds[0].answer).toBeNull();
});

test("rejects oversized lists or a full hash instead of emitting it", async () => {
  execute.mockResolvedValue({ rows: [{ ...empty(), shares: Array.from({ length: 51 }, share) }] });
  await expect(workspaceState(workspace)).rejects.toThrow();
  execute.mockResolvedValue({ rows: [{ ...empty(), shares: [{ ...share(), id: "a".repeat(64) }] }] });
  await expect(workspaceState(workspace)).rejects.toThrow();
});

test("malformed share identifiers never access the database", async () => {
  for (const value of ["", "A".repeat(16), "a".repeat(64), "a' OR true"]) await expect(revokeListedShare(workspace, value)).rejects.toMatchObject({ status: 404 });
  expect(execute).not.toHaveBeenCalled();
});

test("missing and ambiguous scoped matches fail rather than report a revocation", async () => {
  execute.mockResolvedValueOnce({ rows: [{ count: 0, revokedAt: null }] }).mockResolvedValueOnce({ rows: [{ count: 2, revokedAt: null }] });
  await expect(revokeListedShare(workspace, share().id)).rejects.toMatchObject({ status: 404 });
  await expect(revokeListedShare(workspace, share().id)).rejects.toMatchObject({ status: 409 });
  expect(execute).toHaveBeenCalledTimes(2);
});

test("revocation returns only the persisted timestamp and binds scope and prefix", async () => {
  execute.mockResolvedValue({ rows: [{ count: 1, revokedAt: at, token_hash: "secret" }] });
  expect(await revokeListedShare(workspace, share().id)).toEqual({ revokedAt: "2026-10-10T16:00:00.000Z" });
  expect(await revokeListedShare(workspace, share().id)).toEqual({ revokedAt: "2026-10-10T16:00:00.000Z" });
  const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
  expect(query.params).toEqual([workspace, share().id]);
});
