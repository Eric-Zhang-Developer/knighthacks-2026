import { beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/workspace/route";
import { POST as invite } from "@/app/api/workspace/invite/route";
import { POST as redeem } from "@/app/api/workspace/invite/redeem/route";
import { requireWorkspace } from "@/lib/workspace/require";
import { COOKIE, hashToken, newToken, WorkspaceError } from "@/lib/workspace/tokens";
import * as service from "@/lib/workspace/service";
vi.mock("@/lib/workspace/service", () => ({ lookupSession: vi.fn(), createWorkspace: vi.fn(), createInvite: vi.fn(), redeemInvite: vi.fn() }));
const identity = { workspaceId: "00000000-0000-4000-8000-000000000001", memberId: "00000000-0000-4000-8000-000000000002" };
const token = "a".repeat(43);
function request(path = "", options: { cookie?: boolean; origin?: string; body?: unknown; method?: string } = {}) {
  return new NextRequest(`https://uncharted.test/api/workspace${path}`, { method: options.method ?? "POST", headers: {
    origin: options.origin ?? "https://uncharted.test", "content-type": "application/json", ...(options.cookie ? { cookie: `${COOKIE}=${token}` } : {}),
  }, ...(options.method === "GET" ? {} : { body: JSON.stringify(options.body ?? {}) }) });
}
beforeEach(() => { vi.resetAllMocks(); vi.mocked(service.lookupSession).mockResolvedValue(identity); });
test("new sessions set only a secure HttpOnly cookie and return public identity", async () => {
  vi.mocked(service.createWorkspace).mockResolvedValue({ identity, token });
  const result = await POST(request());
  expect(result.status).toBe(201);
  expect(await result.json()).toEqual(identity);
  expect(result.headers.get("cache-control")).toBe("no-store");
  const cookie = result.headers.get("set-cookie")!;
  for (const flag of ["HttpOnly", "Secure", "SameSite=lax", "Path=/"]) expect(cookie).toContain(flag);
});
test("existing session is reused; anonymous reads cannot create workspaces", async () => {
  expect((await POST(request("", { cookie: true }))).status).toBe(200);
  expect(service.createWorkspace).not.toHaveBeenCalled();
  expect((await GET(request("", { method: "GET" }))).status).toBe(401);
});
test("same-origin and membership boundaries precede mutations", async () => {
  expect((await POST(request("", { origin: "https://attacker.test" }))).status).toBe(403);
  expect((await invite(request("/invite", { cookie: true, body: { workspaceId: "another-workspace" } }))).status).toBe(403);
  expect((await invite(request("/invite"))).status).toBe(401);
  expect(service.createWorkspace).not.toHaveBeenCalled();
  expect(service.createInvite).not.toHaveBeenCalled();
  await expect(requireWorkspace(request("", { cookie: true }), "other")).rejects.toMatchObject({ status: 403 });
});
test("invite response uses the public route; failed redeem never sets a cookie", async () => {
  vi.mocked(service.createInvite).mockResolvedValue({ token, expiresAt: "2026-10-11T00:00:00Z" });
  const result = await invite(request("/invite", { cookie: true }));
  expect((await result.json()).inviteUrl).toBe(`https://uncharted.test/invite/${token}`);
  vi.mocked(service.redeemInvite).mockRejectedValue(new WorkspaceError(410, "Invite unavailable"));
  const failed = await redeem(request("/invite/redeem", { body: { token } }));
  expect(failed.status).toBe(410);
  expect(failed.headers.get("set-cookie")).toBeNull();
});
test("unexpected database errors reveal no secrets", async () => {
  vi.mocked(service.createWorkspace).mockRejectedValue(new Error("postgres://secret"));
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("postgres");
});
test("random tokens have entropy and only hashes are suitable for persistence", () => {
  const a = newToken();
  expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(newToken()).not.toBe(a);
  expect(hashToken(a)).toHaveLength(64);
  expect(hashToken(a)).not.toBe(a);
});
