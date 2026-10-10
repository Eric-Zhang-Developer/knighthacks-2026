import { beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
const { lookupSession, createAlternative, getAlternative } = vi.hoisted(() => ({ lookupSession: vi.fn(), createAlternative: vi.fn(), getAlternative: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@/lib/workspace/service", () => ({ lookupSession }));
vi.mock("@/lib/alternative/service", () => ({ createAlternative, getAlternative }));
import { GET, POST } from "@/app/api/alternative/[versionId]/route";
import { COOKIE } from "@/lib/workspace/tokens";
const versionId = "00000000-0000-4000-8000-000000000001", context = { params: Promise.resolve({ versionId }) };
function request(method = "POST", auth = true, origin = "https://uncharted.test", body?: ReadableStream<Uint8Array>) {
  return new NextRequest(`https://uncharted.test/api/alternative/${versionId}`, { method, headers: { origin, ...(auth ? { cookie: `${COOKIE}=${"a".repeat(43)}` } : {}) }, ...(body ? { body, duplex: "half" } : {}) } as ConstructorParameters<typeof NextRequest>[1]);
}
beforeEach(() => { vi.resetAllMocks(); lookupSession.mockResolvedValue({ workspaceId: "workspace", memberId: "member" }); createAlternative.mockResolvedValue({ missingWorkflow: true, points: [] }); getAlternative.mockResolvedValue({ missingWorkflow: true, points: [] }); });
test("authenticated routes use only session workspace and no-store responses", async () => {
  const empty = new ReadableStream<Uint8Array>({ start(c) { c.close(); } });
  const post = await POST(request("POST", true, undefined, empty), context), get = await GET(request("GET"), context);
  for (const response of [post, get]) { expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store"); }
  expect(createAlternative).toHaveBeenCalledWith("workspace", versionId); expect(getAlternative).toHaveBeenCalledWith("workspace", versionId);
});
test("missing auth and cross-origin writes perform no work", async () => {
  expect((await GET(request("GET", false), context)).status).toBe(401);
  expect((await POST(request("POST", false), context)).status).toBe(401);
  expect((await POST(request("POST", true, "https://other.test"), context)).status).toBe(403);
  expect(createAlternative).not.toHaveBeenCalled(); expect(getAlternative).not.toHaveBeenCalled();
});
test("bad identifiers and real body bytes are rejected without buffering", async () => {
  expect((await POST(request(), { params: Promise.resolve({ versionId: "bad" }) })).status).toBe(400);
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({ pull(c) { c.enqueue(new Uint8Array([1])); }, cancel }, { highWaterMark: 0 });
  expect((await POST(request("POST", true, undefined, stream), context)).status).toBe(400);
  expect(cancel).toHaveBeenCalledTimes(1); expect(createAlternative).not.toHaveBeenCalled();
});
test("unexpected database errors reveal no private details", async () => {
  getAlternative.mockRejectedValue(new Error("postgres://secret private"));
  const response = await GET(request("GET"), context);
  expect(response.status).toBe(503); expect(await response.text()).not.toMatch(/postgres|secret|private/);
});
