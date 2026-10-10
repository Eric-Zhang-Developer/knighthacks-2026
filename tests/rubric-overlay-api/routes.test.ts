import { beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
const { lookupSession, createOverlay, getOverlay, patchProof } = vi.hoisted(() => ({ lookupSession: vi.fn(), createOverlay: vi.fn(), getOverlay: vi.fn(), patchProof: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@/lib/workspace/service", () => ({ lookupSession }));
vi.mock("@/lib/rubric/service", () => ({ createOverlay, getOverlay, patchProof }));
import { GET, POST } from "@/app/api/rubric/[versionId]/route";
import { PATCH } from "@/app/api/rubric/[versionId]/[trackId]/route";
import { COOKIE } from "@/lib/workspace/tokens";
const versionId = "00000000-0000-4000-8000-000000000001", context = { params: Promise.resolve({ versionId }) };
const proofContext = { params: Promise.resolve({ versionId, trackId: "best-ai-hack" }) };
function request(method = "POST", auth = true, origin = "https://uncharted.test", body?: string | ReadableStream<Uint8Array>) {
  return new NextRequest(`https://uncharted.test/api/rubric/${versionId}`, { method, headers: { origin, "content-type": "application/json", ...(auth ? { cookie: `${COOKIE}=${"a".repeat(43)}` } : {}) }, ...(body === undefined ? {} : { body, duplex: "half" }) } as ConstructorParameters<typeof NextRequest>[1]);
}
beforeEach(() => { vi.resetAllMocks(); lookupSession.mockResolvedValue({ workspaceId: "workspace", memberId: "member" }); for (const fn of [createOverlay, getOverlay, patchProof]) fn.mockResolvedValue({ versionId, tracks: [] }); });
test("empty Node POST stream and GET use authenticated workspace and no-store", async () => {
  const empty = new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } });
  for (const response of [await POST(request("POST", true, undefined, empty), context), await GET(request("GET"), context)]) {
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store"); expect(response.headers.has("set-cookie")).toBe(false);
  }
  expect(createOverlay).toHaveBeenCalledWith("workspace", versionId); expect(getOverlay).toHaveBeenCalledWith("workspace", versionId);
});
test("missing sessions and cross-origin mutations perform no work", async () => {
  expect((await GET(request("GET", false), context)).status).toBe(401);
  expect((await POST(request("POST", false), context)).status).toBe(401);
  expect((await POST(request("POST", true, "https://foreign.test"), context)).status).toBe(403);
  expect((await PATCH(request("PATCH", true, "https://foreign.test", '{"proof":"note"}'), proofContext)).status).toBe(403);
  expect(createOverlay).not.toHaveBeenCalled(); expect(patchProof).not.toHaveBeenCalled();
});
test("PATCH passes only bounded proof to scoped service", async () => {
  expect((await PATCH(request("PATCH", true, undefined, '{"proof":" note "}'), proofContext)).status).toBe(200);
  expect(patchProof).toHaveBeenCalledWith("workspace", versionId, "best-ai-hack", "note");
  for (const body of ['{"proof":""}', '{"proof":"note","score":5}', JSON.stringify({ proof: "x".repeat(4001) }), "bad json"]) {
    expect((await PATCH(request("PATCH", true, undefined, body), proofContext)).status).toBe(400);
  }
  expect(patchProof).toHaveBeenCalledTimes(1);
});
test("invalid IDs and body bytes reject without accumulation", async () => {
  expect((await POST(request(), { params: Promise.resolve({ versionId: "bad" }) })).status).toBe(400);
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array([1])); }, cancel }, { highWaterMark: 0 });
  expect((await POST(request("POST", true, undefined, stream), context)).status).toBe(400); expect(cancel).toHaveBeenCalled();
  expect(createOverlay).not.toHaveBeenCalled();
});
test("unexpected SQL errors are safe responses", async () => {
  getOverlay.mockRejectedValue(new Error("postgres://secret provider detail"));
  const response = await GET(request("GET"), context); expect(response.status).toBe(503); expect(await response.text()).not.toMatch(/postgres|secret|detail/);
});
