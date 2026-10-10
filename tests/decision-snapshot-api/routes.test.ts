import { beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
const { lookupSession, createSnapshot, getSnapshot } = vi.hoisted(() => ({ lookupSession: vi.fn(), createSnapshot: vi.fn(), getSnapshot: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@/lib/workspace/service", () => ({ lookupSession }));
vi.mock("@/lib/snapshots/service", () => ({ createSnapshot, getSnapshot }));
import { POST } from "@/app/api/snapshots/route";
import { GET } from "@/app/api/snapshots/[id]/route";
import { COOKIE } from "@/lib/workspace/tokens";
import { EvidenceError } from "@/lib/evidence/contract";
const id = "00000000-0000-4000-8000-000000000001", context = { params: Promise.resolve({ id }) };
function request(body: unknown = { versionId: id }, options: { method?: string; auth?: boolean; origin?: string; raw?: string } = {}) {
  return new NextRequest("https://uncharted.test/api/snapshots", { method: options.method ?? "POST", headers: { origin: options.origin ?? "https://uncharted.test", "content-type": "application/json", ...(options.auth === false ? {} : { cookie: `${COOKIE}=${"a".repeat(43)}` }) }, ...(options.method === "GET" ? {} : { body: options.raw ?? JSON.stringify(body) }) });
}
beforeEach(() => { vi.resetAllMocks(); lookupSession.mockResolvedValue({ workspaceId: "workspace", memberId: "member" }); });
test("POST201 envelopes frozen data; GET returns only data, both no-store", async () => {
  const data = { versionId: id, nextTest: null };
  createSnapshot.mockResolvedValue({ snapshotId: id, data }); getSnapshot.mockResolvedValue(data);
  const created = await POST(request());
  expect(created.status).toBe(201); expect(await created.json()).toEqual({ snapshotId: id, data });
  expect(createSnapshot).toHaveBeenCalledWith("workspace", id);
  const read = await GET(request(null, { method: "GET" }), context);
  expect(await read.json()).toEqual(data); expect(getSnapshot).toHaveBeenCalledWith("workspace", id);
  for (const response of [created, read]) expect(response.headers.get("cache-control")).toBe("no-store");
});
test("anonymous reads/writes and cross-origin creation stop before snapshot access", async () => {
  expect((await POST(request({}, { auth: false }))).status).toBe(401);
  expect((await GET(request(null, { auth: false, method: "GET" }), context)).status).toBe(401);
  expect((await POST(request({}, { origin: "https://other.test" }))).status).toBe(403);
  expect(createSnapshot).not.toHaveBeenCalled(); expect(getSnapshot).not.toHaveBeenCalled();
});
test("invalid IDs, extra private fields, malformed and oversized bodies are rejected", async () => {
  expect((await POST(request({ versionId: "invalid" }))).status).toBe(400);
  expect((await POST(request({ versionId: id, notes: "private" }))).status).toBe(400);
  expect((await POST(request({}, { raw: "{" }))).status).toBe(400);
  expect((await POST(request({}, { raw: " ".repeat(65537) }))).status).toBe(413);
  expect((await GET(request(null, { method: "GET" }), { params: Promise.resolve({ id: "bad" }) })).status).toBe(400);
  expect(createSnapshot).not.toHaveBeenCalled(); expect(getSnapshot).not.toHaveBeenCalled();
});
test("database errors are sanitized", async () => {
  createSnapshot.mockRejectedValue(new Error("postgres://secret private"));
  const response = await POST(request());
  expect(response.status).toBe(503); expect(await response.text()).not.toMatch(/postgres|secret|private/);
});
test.each([404, 502, 503])("evidence failures retain the safe status %s for the caller", async (status) => {
  createSnapshot.mockRejectedValue(new EvidenceError(status, "Evidence unavailable. Please retry."));
  const response = await POST(request());
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ error: "Evidence unavailable. Please retry." });
});
