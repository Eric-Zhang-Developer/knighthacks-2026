import { beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
const { lookupSession, suggest, accept, manual } = vi.hoisted(() => ({
  lookupSession: vi.fn(), suggest: vi.fn(), accept: vi.fn(), manual: vi.fn() }));
vi.mock("@/lib/workspace/service", () => ({ lookupSession }));
vi.mock("@/lib/branches/service", () => ({ suggest, accept, manual }));
import { POST as suggestRoute } from "@/app/api/branches/suggest/route";
import { POST as acceptRoute } from "@/app/api/branches/[directionId]/accept/route";
import { POST as manualRoute } from "@/app/api/branches/manual/route";
import { COOKIE } from "@/lib/workspace/tokens";
import { IdeaError } from "@/lib/ideas/contract";
const id = "11111111-1111-4111-8111-111111111111";
const params = (directionId = id) => ({ params: Promise.resolve({ directionId }) });
function request(body?: unknown, cookie = true, origin = "https://uncharted.test") {
  return new NextRequest("https://uncharted.test/api/branches", { method: "POST", headers: {
    origin, "content-type": "application/json", ...(cookie ? { cookie: `${COOKIE}=${"a".repeat(43)}` } : {}),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
beforeEach(() => { vi.resetAllMocks(); lookupSession.mockResolvedValue({ workspaceId: "workspace-a" }); });

test("routes pass only the authenticated workspace and validated payload", async () => {
  suggest.mockResolvedValue({ directions: [] });
  expect((await suggestRoute(request({ versionId: id }))).status).toBe(200);
  expect(suggest).toHaveBeenCalledWith("workspace-a", id);
  manual.mockResolvedValue({ versionId: id });
  expect((await manualRoute(request({ versionId: id, fields: { title: "A different direction" } }))).status).toBe(201);
  expect(manual).toHaveBeenCalledWith("workspace-a", id, { title: "A different direction" });
});
test("accept returns the version with 201 for a new row and 200 on retry", async () => {
  accept.mockResolvedValueOnce({ created: true, version: { versionId: id } }).mockResolvedValueOnce({ created: false, version: { versionId: id } });
  const first = await acceptRoute(request(), params());
  expect(first.status).toBe(201); expect(await first.json()).toEqual({ versionId: id });
  expect((await acceptRoute(request(), params())).status).toBe(200);
  expect(accept).toHaveBeenCalledWith("workspace-a", id);
});
test("all mutations reject missing sessions and foreign origins before service calls", async () => {
  for (const route of [suggestRoute, manualRoute]) {
    expect((await route(request({}, false))).status).toBe(401);
    expect((await route(request({}, true, "https://other.test"))).status).toBe(403);
  }
  expect((await acceptRoute(request(undefined, false), params())).status).toBe(401);
  expect((await acceptRoute(request(undefined, true, "https://other.test"), params())).status).toBe(403);
  expect(suggest).not.toHaveBeenCalled(); expect(manual).not.toHaveBeenCalled(); expect(accept).not.toHaveBeenCalled();
});
test("malformed ids, unsupported edits, empty edits and excessive text cannot reach persistence", async () => {
  for (const body of [{ versionId: "bad" }, { versionId: id, workspaceId: id }]) expect((await suggestRoute(request(body))).status).toBe(400);
  for (const fields of [{}, { parentId: id }, { title: "x".repeat(201) }, { workflow: 10 }]) {
    expect((await manualRoute(request({ versionId: id, fields }))).status).toBe(400);
  }
  expect((await acceptRoute(request(), params("bad"))).status).toBe(404);
  expect(suggest).not.toHaveBeenCalled(); expect(manual).not.toHaveBeenCalled(); expect(accept).not.toHaveBeenCalled();
});
test("oversized bodies are rejected and internal failures are sanitized", async () => {
  expect((await suggestRoute(request({ versionId: id, extra: "x".repeat(66000) }))).status).toBe(413);
  accept.mockRejectedValueOnce(new Error("postgres://private"));
  const failed = await acceptRoute(request(), params());
  expect(failed.status).toBe(503); expect(await failed.text()).not.toMatch(/postgres|private/);
  accept.mockRejectedValueOnce(new IdeaError(404, "Direction not found"));
  expect((await acceptRoute(request(), params())).status).toBe(404);
});
