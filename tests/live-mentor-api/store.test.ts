import { beforeEach, expect, test, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { createHash } from "node:crypto";
const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: () => ({ execute }) }));
import { reserveSession, endSession, reserveTool, completeTool, failTool } from "@/lib/mentor/store";
import { canonical, type ToolCall } from "@/lib/mentor/contract";
const identity = { workspaceId: "11111111-1111-4111-8111-111111111111", memberId: "22222222-2222-4222-8222-222222222222" };
const call: ToolCall = { sessionId: "33333333-3333-4333-8333-333333333333", turnId: 2, callId: "a".repeat(64), tool: "find_projects", args: { query: "grounded idea" } };
const digest = createHash("sha256").update(canonical(call)).digest("hex");
const stored = { digest, reservationId: "earlier-reservation", turnId: call.turnId, tool: call.tool, status: "pending" };
const queryAt = (index = 0) => new PgDialect().sqlToQuery(execute.mock.calls[index][0]);
beforeEach(() => { vi.resetAllMocks(); });

test("issuance reserves both sliding budgets and creates an expiring session in one atomic SQL statement", async () => {
  execute.mockResolvedValue({ rows: [{ id: "reserved" }] });
  expect(await reserveSession(identity)).toMatch(/^[a-f0-9-]{36}$/);
  expect(execute).toHaveBeenCalledTimes(1);
  const query = queryAt();
  expect(query.sql).toContain("on conflict (workspace_id) do update");
  expect(query.sql).toContain("jsonb_array_elements(mentor_budgets.events)");
  expect(query.sql).toContain("interval '1 hour')) < 12");
  expect(query.sql).toContain("interval '10 minutes')) < 3");
  expect(query.sql).toContain("interval '20 minutes'");
  expect(query.sql).toContain("insert into mentor_sessions");
  expect(query.sql).not.toMatch(/advisory|delete|conversation_token/i);
  expect(query.params).toContain(identity.workspaceId); expect(query.params).toContain(identity.memberId);
});

test("exhausted session issuance fails without refunding or a second write", async () => {
  execute.mockResolvedValue({ rows: [] });
  await expect(reserveSession(identity)).rejects.toMatchObject({ status: 429 });
  expect(execute).toHaveBeenCalledTimes(1);
});

test("end is idempotent and scoped to the workspace and member; foreign IDs remain missing", async () => {
  execute.mockResolvedValueOnce({ rows: [{ id: call.sessionId }] }).mockResolvedValueOnce({ rows: [{ id: call.sessionId }] }).mockResolvedValueOnce({ rows: [] });
  await endSession(identity, call.sessionId); await endSession(identity, call.sessionId);
  expect(queryAt().sql).toContain("coalesce(ended_at, now())");
  expect(queryAt().params).toEqual([call.sessionId, identity.workspaceId, identity.memberId]);
  await expect(endSession(identity, call.sessionId)).rejects.toMatchObject({ status: 404 });
});

test("reservation winner runs once and concurrent identical pending redelivery does not run", async () => {
  let entry: unknown;
  execute.mockImplementationOnce(async (statement) => {
    const query = new PgDialect().sqlToQuery(statement);
    entry = JSON.parse(query.params.find((value) => typeof value === "string" && value.startsWith('{"digest"')) as string);
    return { rows: [{ entry, sourceIds: ["1".repeat(40)] }] };
  }).mockImplementationOnce(async () => ({ rows: [{ entry, sourceIds: [] }] }));
  expect(await reserveTool(identity, call)).toEqual({ status: "run", sourceIds: new Set(["1".repeat(40)]) });
  expect(await reserveTool(identity, call)).toEqual({ status: "pending" });
  const query = queryAt();
  expect(query.sql).toContain("update mentor_sessions s");
  expect(query.sql).toContain("then s.calls else s.calls ||");
  expect(query.sql).toContain("s.ended_at is null and s.expires_at > clock_timestamp()");
  expect(query.sql).toContain("jsonb_object_keys(s.calls)) < 40");
  expect(query.sql).toContain(") < 8");
});

test("completed duplicates replay exact stored result while changed bodies conflict", async () => {
  const data = { query: "grounded idea", projects: [] };
  execute.mockResolvedValue({ rows: [{ entry: { ...stored, status: "completed", data }, sourceIds: [] }] });
  expect(await reserveTool(identity, call)).toEqual({ status: "replay", data });
  await expect(reserveTool(identity, { ...call, args: { query: "different" } })).rejects.toMatchObject({ status: 409 });
});

test.each([
  { rows: [], status: 404 },
  { rows: [{ endedAt: new Date(), expired: false }], status: 409 },
  { rows: [{ endedAt: null, expired: true }], status: 409 },
  { rows: [{ endedAt: null, expired: false }], status: 429 },
])("rejected reservation distinguishes owned exhausted/ended sessions from unknown sessions ($status)", async ({ rows, status }) => {
  execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows });
  await expect(reserveTool(identity, call)).rejects.toMatchObject({ status });
  expect(queryAt(1).params).toEqual([call.sessionId, identity.workspaceId, identity.memberId]);
});

test("completion atomically publishes only matching active pending calls and records bounded corpus citations", async () => {
  execute.mockResolvedValue({ rows: [{ id: call.sessionId }] });
  await completeTool(identity, call, { sourceIds: ["1".repeat(40), "1".repeat(40), "invented"], projects: [] });
  const query = queryAt();
  expect(query.sql).toContain("s.ended_at is null and s.expires_at > clock_timestamp()");
  expect(query.sql).toContain("->>'digest' ="); expect(query.sql).toContain("->>'status' = 'pending'");
  expect(query.params).toContain(digest); expect(query.params).toContain(JSON.stringify(["1".repeat(40)]));
  expect(query.sql).not.toMatch(/insert into ideas|idea_versions|snapshots/);
  execute.mockResolvedValueOnce({ rows: [] });
  await expect(completeTool(identity, call, { projects: [] })).rejects.toMatchObject({ status: 409, message: expect.stringContaining("cancelled") });
});

test("proposals cannot add session evidence and oversize Unicode results fail before any write", async () => {
  execute.mockResolvedValue({ rows: [{ id: call.sessionId }] });
  const proposal: ToolCall = { ...call, tool: "propose_idea", args: { fields: { title: "Idea", description: null, audience: null, problem: null, workflow: null, constraints: null }, rationale: "Why", sourceIds: [] } };
  await completeTool(identity, proposal, { sourceIds: ["2".repeat(40)] });
  expect(queryAt().params).toContain("[]");
  execute.mockClear();
  await expect(completeTool(identity, call, { text: "😀".repeat(40000) })).rejects.toMatchObject({ status: 503 });
  expect(execute).not.toHaveBeenCalled();
});

test("tool failure is terminal safe replay data, and database errors never disclose connection details", async () => {
  execute.mockResolvedValueOnce({ rows: [{ id: call.sessionId }] });
  await failTool(identity, call);
  const serialized = queryAt().params.find((value) => typeof value === "string" && value.startsWith('{"status"')) as string;
  expect(JSON.parse(serialized)).toMatchObject({ status: "failed", error: expect.any(String) });
  execute.mockRejectedValueOnce(new Error("postgres://user:password@host/db"));
  await expect(reserveSession(identity)).rejects.toMatchObject({ status: 503, message: "Mentor session storage is temporarily unavailable. Please retry." });
});
