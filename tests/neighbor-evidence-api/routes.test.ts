import { beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
const { lookupSession, createEvidence, getEvidence } = vi.hoisted(() => ({ lookupSession: vi.fn(), createEvidence: vi.fn(), getEvidence: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@/lib/workspace/service", () => ({ lookupSession }));
vi.mock("@/lib/evidence/service", () => ({ createEvidence, getEvidence }));
import { GET, POST } from "@/app/api/evidence/[versionId]/route";
import { COOKIE } from "@/lib/workspace/tokens";
import { EvidenceError } from "@/lib/evidence/contract";
const versionId = "00000000-0000-4000-8000-000000000001";
const context = { params: Promise.resolve({ versionId }) };
function request(method = "POST", options: { cookie?: boolean; origin?: string; query?: string; body?: string } = {}) {
  return new NextRequest(`https://uncharted.test/api/evidence/${versionId}${options.query ?? ""}`, { method, headers: {
    origin: options.origin ?? "https://uncharted.test", ...(options.cookie === false ? {} : { cookie: `${COOKIE}=${"a".repeat(43)}` }),
  }, ...(options.body === undefined ? {} : { body: options.body }) });
}
beforeEach(() => { vi.resetAllMocks(); lookupSession.mockResolvedValue({ workspaceId: "workspace", memberId: "member" }); createEvidence.mockResolvedValue({ cards: [] }); getEvidence.mockResolvedValue({ cards: [] }); });
test("authenticated POST/GET use the session workspace with no-store responses", async () => {
  const response = await POST(request(), context);
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
  expect(createEvidence).toHaveBeenCalledWith("workspace", versionId, false);
  await POST(request("POST", { query: "?all=true" }), context);
  expect(createEvidence).toHaveBeenLastCalledWith("workspace", versionId, true);
  expect(await (await GET(request("GET"), context)).json()).toEqual({ cards: [] });
  expect(getEvidence).toHaveBeenCalledWith("workspace", versionId);
});
test("anonymous reads/writes and cross-origin mutations do no evidence work", async () => {
  expect((await GET(request("GET", { cookie: false }), context)).status).toBe(401);
  expect((await POST(request("POST", { cookie: false }), context)).status).toBe(401);
  expect((await POST(request("POST", { origin: "https://other.test" }), context)).status).toBe(403);
  expect(createEvidence).not.toHaveBeenCalled(); expect(getEvidence).not.toHaveBeenCalled();
});
test("invalid UUID, unbounded body and unrecognized request options are rejected", async () => {
  expect((await POST(request(), { params: Promise.resolve({ versionId: "bad" }) })).status).toBe(400);
  expect((await POST(request("POST", { body: "x".repeat(100000) }), context)).status).toBe(400);
  expect((await POST(request("POST", { query: "?all=false" }), context)).status).toBe(400);
  expect((await POST(request("POST", { query: "?projectId=other" }), context)).status).toBe(400);
  expect(createEvidence).not.toHaveBeenCalled();
});
test("foreign/missing version and provider errors preserve safe status; raw database errors do not escape", async () => {
  createEvidence.mockRejectedValueOnce(new EvidenceError(404, "Idea version not found"));
  expect((await POST(request(), context)).status).toBe(404);
  createEvidence.mockRejectedValueOnce(new EvidenceError(502, "Evidence generation is temporarily unavailable. Please try again."));
  expect((await POST(request(), context)).status).toBe(502);
  createEvidence.mockRejectedValueOnce(new Error("postgres://secret provider content"));
  const response = await POST(request(), context);
  expect(response.status).toBe(503); expect(await response.text()).not.toMatch(/postgres|secret|provider content/);
});

test("an empty streamed HTTP POST body is accepted without weakening the no-body contract", async () => {
  const empty = new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } });
  const req = new NextRequest(`https://uncharted.test/api/evidence/${versionId}`, {
    method: "POST", headers: { origin: "https://uncharted.test", cookie: `${COOKIE}=${"a".repeat(43)}` },
    body: empty, duplex: "half",
  } as ConstructorParameters<typeof NextRequest>[1]);
  expect((await POST(req, context)).status).toBe(200);
  expect(createEvidence).toHaveBeenCalledTimes(1);
});

test("first actual request byte cancels upstream without consuming the remainder", async () => {
  const cancel = vi.fn();
  let pulls = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) { pulls++; controller.enqueue(new Uint8Array([1])); }, cancel,
  }, { highWaterMark: 0 });
  const req = new NextRequest(`https://uncharted.test/api/evidence/${versionId}`, {
    method: "POST", headers: { origin: "https://uncharted.test", cookie: `${COOKIE}=${"a".repeat(43)}` },
    body: stream, duplex: "half",
  } as ConstructorParameters<typeof NextRequest>[1]);
  expect((await POST(req, context)).status).toBe(400);
  expect(cancel).toHaveBeenCalledTimes(1); expect(pulls).toBe(1);
  expect(createEvidence).not.toHaveBeenCalled();
});
