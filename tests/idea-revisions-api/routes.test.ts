import { beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
const { lookupSession, propose, accept, reject, trail } = vi.hoisted(() => ({
  lookupSession: vi.fn(), propose: vi.fn(), accept: vi.fn(), reject: vi.fn(), trail: vi.fn() }));
vi.mock("@/lib/workspace/service", () => ({ lookupSession }));
vi.mock("@/lib/revisions/service", () => ({ propose, accept, reject, trail }));
import { POST as proposeRoute } from "@/app/api/revisions/propose/route";
import { POST as acceptRoute } from "@/app/api/revisions/[suggestionId]/accept/route";
import { POST as rejectRoute } from "@/app/api/revisions/[suggestionId]/reject/route";
import { GET as trailRoute } from "@/app/api/revisions/trail/[ideaId]/route";
import { COOKIE } from "@/lib/workspace/tokens";
import { IdeaError } from "@/lib/ideas/contract";

const id = "11111111-1111-4111-8111-111111111111";
const params = <T extends string>(key: T, value: string) => ({ params: Promise.resolve({ [key]: value } as Record<T, string>) });
function request(body?: unknown, options: { cookie?: boolean; origin?: string; method?: string } = {}) {
  return new NextRequest("https://uncharted.test/api/revisions", { method: options.method ?? "POST", headers: {
    origin: options.origin ?? "https://uncharted.test", "content-type": "application/json",
    ...(options.cookie === false ? {} : { cookie: `${COOKIE}=${"a".repeat(43)}` }),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
beforeEach(() => { vi.resetAllMocks(); lookupSession.mockResolvedValue({ workspaceId: "workspace-a", memberId: "member-a" }); });

test("propose passes the caller's workspace, version and context", async () => {
  propose.mockResolvedValue({ suggestions: [] });
  const response = await proposeRoute(request({ versionId: id, context: "a challenge outcome" }));
  expect(response.status).toBe(200);
  expect(propose).toHaveBeenCalledWith("workspace-a", id, "a challenge outcome");
});
test("accept returns 201 for a new version and 200 for a repeated accept", async () => {
  accept.mockResolvedValueOnce({ created: true, version: { versionId: "v2" } }).mockResolvedValueOnce({ created: false, version: { versionId: "v2" } });
  expect((await acceptRoute(request(), params("suggestionId", id))).status).toBe(201);
  expect((await acceptRoute(request(), params("suggestionId", id))).status).toBe(200);
  expect(accept).toHaveBeenCalledWith("workspace-a", id);
});
test("reject and trail are workspace-scoped; unknown ids are 404", async () => {
  expect(await (await rejectRoute(request(), params("suggestionId", id))).json()).toEqual({ rejected: true });
  expect(reject).toHaveBeenCalledWith("workspace-a", id);
  trail.mockRejectedValue(new IdeaError(404, "Idea not found"));
  expect((await trailRoute(request(undefined, { method: "GET" }), params("ideaId", id))).status).toBe(404);
  expect((await acceptRoute(request(), params("suggestionId", "not-a-uuid"))).status).toBe(404);
  expect(accept).not.toHaveBeenCalled();
});
test("unauthenticated, cross-origin and malformed requests never reach the service", async () => {
  expect((await proposeRoute(request({ versionId: id }, { cookie: false }))).status).toBe(401);
  expect((await acceptRoute(request(undefined, { cookie: false }), params("suggestionId", id))).status).toBe(401);
  expect((await acceptRoute(request(undefined, { origin: "https://other.test" }), params("suggestionId", id))).status).toBe(403);
  expect((await rejectRoute(request(undefined, { origin: "https://other.test" }), params("suggestionId", id))).status).toBe(403);
  expect((await proposeRoute(request({ versionId: "x" }))).status).toBe(400);
  expect((await proposeRoute(request({ versionId: id, extra: 1 }))).status).toBe(400);
  expect(propose).not.toHaveBeenCalled(); expect(accept).not.toHaveBeenCalled(); expect(reject).not.toHaveBeenCalled();
});
test("database errors are sanitized", async () => {
  accept.mockRejectedValue(new Error("postgres://secret"));
  const response = await acceptRoute(request(), params("suggestionId", id));
  expect(response.status).toBe(503); expect(await response.text()).not.toMatch(/secret|postgres/);
});
