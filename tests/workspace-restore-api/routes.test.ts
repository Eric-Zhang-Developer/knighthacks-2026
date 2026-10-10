import { beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
const { lookupSession, workspaceState, revokeListedShare } = vi.hoisted(() => ({ lookupSession: vi.fn(), workspaceState: vi.fn(), revokeListedShare: vi.fn() }));
vi.mock("@/lib/workspace/service", () => ({ lookupSession }));
vi.mock("@/lib/workspace/state", () => ({ workspaceState, revokeListedShare }));
import { GET } from "@/app/api/workspace/state/route";
import { POST } from "@/app/api/workspace/shares/[id]/revoke/route";
import { WorkspaceError } from "@/lib/workspace/tokens";
const identity = { workspaceId: "10000000-0000-4000-8000-000000000001", memberId: "10000000-0000-4000-8000-000000000002" };
const prefix = "abcdef0123456789";
const context = (id = prefix) => ({ params: Promise.resolve({ id }) });
function request(method = "GET", cookie = true, origin = "https://uncharted.test", body?: string) {
  return new NextRequest("https://uncharted.test/api/workspace/state", { method, headers: { origin, ...(cookie ? { cookie: `__Host-uncharted-session=${"a".repeat(43)}` } : {}) }, ...(body === undefined ? {} : { body }) });
}
beforeEach(() => { vi.resetAllMocks(); lookupSession.mockResolvedValue(identity); workspaceState.mockResolvedValue({ ideas: [], challenges: [], snapshots: [], shares: [] }); revokeListedShare.mockResolvedValue({ revokedAt: "2026-10-10T00:00:00.000Z" }); });

test("requires an existing session and never accesses state for missing/invalid sessions", async () => {
  expect((await GET(request("GET", false))).status).toBe(401);
  lookupSession.mockResolvedValue(null);
  expect((await GET(request())).status).toBe(401);
  expect((await POST(request("POST"), context())).status).toBe(401);
  expect(workspaceState).not.toHaveBeenCalled(); expect(revokeListedShare).not.toHaveBeenCalled();
});

test("scopes reads to authenticated identity with no cookie or cache", async () => {
  const response = await GET(request());
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store"); expect(response.headers.get("set-cookie")).toBeNull();
  expect(await response.json()).toEqual({ ideas: [], challenges: [], snapshots: [], shares: [] });
  expect(workspaceState).toHaveBeenCalledWith(identity.workspaceId);
});

test("cross-origin mutations and malformed IDs stop before mutation", async () => {
  expect((await POST(request("POST", true, "https://evil.test"), context())).status).toBe(403);
  expect((await POST(request("POST"), context("invalid"))).status).toBe(404);
  expect(revokeListedShare).not.toHaveBeenCalled();
});

test("empty streaming POST is valid while actual bytes are rejected", async () => {
  const input = new NextRequest(request("POST"), { body: new ReadableStream({ start(controller) { controller.close(); } }), duplex: "half" } as ConstructorParameters<typeof NextRequest>[1]);
  expect((await POST(input, context())).status).toBe(200);
  expect(revokeListedShare).toHaveBeenCalledWith(identity.workspaceId, prefix);
  revokeListedShare.mockClear();
  expect((await POST(request("POST", true, "https://uncharted.test", "{}"), context())).status).toBe(400);
  expect(revokeListedShare).not.toHaveBeenCalled();
});

test("foreign IDs and collisions retain safe statuses", async () => {
  for (const status of [404, 409]) {
    revokeListedShare.mockRejectedValueOnce(new WorkspaceError(status, "Share unavailable"));
    expect((await POST(request("POST"), context())).status).toBe(status);
  }
});

test("unknown lookup and database errors are sanitized and fail closed", async () => {
  lookupSession.mockRejectedValueOnce(new Error("secret-database-url"));
  const auth = await GET(request()); expect(auth.status).toBe(503); expect(await auth.text()).not.toContain("secret");
  expect(workspaceState).not.toHaveBeenCalled();
  workspaceState.mockRejectedValueOnce(new Error("secret-database-url"));
  const response = await GET(request()); expect(response.status).toBe(503); expect(await response.text()).not.toContain("secret");
});
