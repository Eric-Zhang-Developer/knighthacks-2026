import { beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
const { lookupSession, createShare, readShare, revokeShare } = vi.hoisted(() => ({ lookupSession: vi.fn(), createShare: vi.fn(), readShare: vi.fn(), revokeShare: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@/lib/workspace/service", () => ({ lookupSession }));
vi.mock("@/lib/shares/service", () => ({ createShare, readShare, revokeShare }));
import { POST } from "@/app/api/shares/route";
import { GET, DELETE } from "@/app/api/shares/[token]/route";
import { COOKIE } from "@/lib/workspace/tokens";
import { ShareError } from "@/lib/shares/tokens";
const id = "00000000-0000-4000-8000-000000000001", token = "A".repeat(22), context = { params: Promise.resolve({ token }) };
function request(method: string, options: { auth?: boolean; origin?: string; body?: unknown; raw?: string } = {}) {
  return new NextRequest("https://uncharted.test/api/shares", { method, headers: {
    origin: options.origin ?? "https://uncharted.test", "content-type": "application/json", "x-forwarded-host": "attacker.test",
    ...(options.auth ? { cookie: `${COOKIE}=${"a".repeat(43)}` } : {}),
  }, ...(method === "POST" ? { body: options.raw ?? JSON.stringify(options.body ?? { snapshotId: id }) } : {}) });
}
beforeEach(() => { vi.resetAllMocks(); lookupSession.mockResolvedValue({ workspaceId: "workspace", memberId: "member" }); createShare.mockResolvedValue(token); readShare.mockResolvedValue({ idea: { title: "Frozen" } }); });
test("creation is scoped and URL uses app origin rather than forwarded input", async () => {
  const response = await POST(request("POST", { auth: true }));
  expect(response.status).toBe(201); expect(await response.json()).toEqual({ token, url: `https://uncharted.test/s/${token}` });
  expect(createShare).toHaveBeenCalledWith("workspace", id);
});
test("public GET never looks up a session or sets cookies and returns only snapshot JSON", async () => {
  for (const auth of [false, true]) {
    const response = await GET(request("GET", { auth }), context);
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ idea: { title: "Frozen" } });
    expect(response.headers.has("set-cookie")).toBe(false); expect(response.headers.get("cache-control")).toBe("no-store");
  }
  expect(lookupSession).not.toHaveBeenCalled();
});
test("revoked public response is exact and uncached", async () => {
  readShare.mockRejectedValue(new ShareError(410, "revoked"));
  const response = await GET(request("GET"), context);
  expect(response.status).toBe(410); expect(await response.json()).toEqual({ error: "revoked" });
  expect(response.headers.has("set-cookie")).toBe(false); expect(response.headers.get("cache-control")).toBe("no-store");
});
test("mutations need authentication and same-origin; owning members can revoke repeatedly", async () => {
  expect((await POST(request("POST"))).status).toBe(401);
  expect((await DELETE(request("DELETE"), context)).status).toBe(401);
  expect((await DELETE(request("DELETE", { auth: true, origin: "https://other.test" }), context)).status).toBe(403);
  expect(revokeShare).not.toHaveBeenCalled();
  for (let i = 0; i < 2; i++) {
    const response = await DELETE(request("DELETE", { auth: true }), context);
    expect(response.status).toBe(204); expect(await response.text()).toBe(""); expect(response.headers.get("cache-control")).toBe("no-store");
  }
  expect(revokeShare).toHaveBeenCalledWith("workspace", token);
});
test("strict bounded input and sanitized database errors", async () => {
  expect((await POST(request("POST", { auth: true, body: { snapshotId: id, url: "https://other.test" } }))).status).toBe(400);
  expect((await POST(request("POST", { auth: true, raw: "{" }))).status).toBe(400);
  expect((await POST(request("POST", { auth: true, raw: " ".repeat(65537) }))).status).toBe(413);
  expect(createShare).not.toHaveBeenCalled();
  readShare.mockRejectedValue(new Error("postgres://secret capability"));
  const response = await GET(request("GET"), context);
  expect(response.status).toBe(503); expect(await response.text()).not.toMatch(/secret|capability|postgres/);
});
