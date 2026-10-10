import { beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
const { lookupSession, createIdea, listIdeas, interpret } = vi.hoisted(() => ({ lookupSession: vi.fn(), createIdea: vi.fn(), listIdeas: vi.fn(), interpret: vi.fn() }));
vi.mock("@/lib/workspace/service", () => ({ lookupSession }));
vi.mock("@/lib/ideas/service", () => ({ createIdea, listIdeas }));
vi.mock("@/lib/ideas/interpret", () => ({ interpret }));
import { POST, GET } from "@/app/api/ideas/route";
import { POST as interpretRoute } from "@/app/api/ideas/interpret/route";
import { COOKIE } from "@/lib/workspace/tokens";
import { IdeaError } from "@/lib/ideas/contract";
const fields = { title: "Idea", description: null, audience: null, problem: null, workflow: null, constraints: null };
function request(body: unknown = fields, options: { method?: string; cookie?: boolean; origin?: string; key?: string; raw?: string } = {}) {
  return new NextRequest("https://uncharted.test/api/ideas", { method: options.method ?? "POST", headers: {
    origin: options.origin ?? "https://uncharted.test", "content-type": "application/json", "idempotency-key": options.key ?? "save-1",
    ...(options.cookie === false ? {} : { cookie: `${COOKIE}=${"a".repeat(43)}` }),
  }, ...(options.method === "GET" ? {} : { body: options.raw ?? JSON.stringify(body) }) });
}
beforeEach(() => { vi.resetAllMocks(); lookupSession.mockResolvedValue({ workspaceId: "workspace-a", memberId: "member-a" }); });
test("save and retry use authenticated workspace and no-store response", async () => {
  createIdea.mockResolvedValue({ created: true, version: { versionId: "v1", ...fields } });
  const response = await POST(request());
  expect(response.status).toBe(201); expect(response.headers.get("cache-control")).toBe("no-store");
  expect(createIdea).toHaveBeenCalledWith("workspace-a", "save-1", fields);
  createIdea.mockResolvedValue({ created: false, version: { versionId: "v1", ...fields } });
  expect((await POST(request())).status).toBe(200);
});
test("unauthenticated and cross-origin requests never call idea services", async () => {
  expect((await POST(request(fields, { cookie: false }))).status).toBe(401);
  expect((await GET(request(null, { method: "GET", cookie: false }))).status).toBe(401);
  expect((await interpretRoute(request({ text: "Idea" }, { cookie: false }))).status).toBe(401);
  expect((await POST(request(fields, { origin: "https://other.test" }))).status).toBe(403);
  expect((await interpretRoute(request({ text: "Idea" }, { origin: "https://other.test" }))).status).toBe(403);
  expect(createIdea).not.toHaveBeenCalled(); expect(listIdeas).not.toHaveBeenCalled(); expect(interpret).not.toHaveBeenCalled();
});
test.each([{}, { ...fields, title: 42 }, { ...fields, title: "x".repeat(201) }, { ...fields, title: null }, { ...fields, workspaceId: "workspace-b" }])("invalid save fields do not persist (%#)", async (body) => {
  expect((await POST(request(body))).status).toBe(400); expect(createIdea).not.toHaveBeenCalled();
});
test("invalid JSON, bounded envelope and missing key fail safely", async () => {
  expect((await POST(request(fields, { raw: "{" }))).status).toBe(400);
  expect((await POST(request(fields, { raw: " ".repeat(65537) }))).status).toBe(413);
  expect((await POST(request(fields, { key: "" }))).status).toBe(400);
  expect(createIdea).not.toHaveBeenCalled();
});
test("interpret validates text, returns nullable fields, and maps provider failures to 502", async () => {
  interpret.mockResolvedValue(fields);
  expect(await (await interpretRoute(request({ text: "Idea" }))).json()).toEqual(fields);
  expect((await interpretRoute(request({ text: " " }))).status).toBe(400);
  expect((await interpretRoute(request({ text: "x".repeat(8001) }))).status).toBe(400);
  interpret.mockRejectedValue(new IdeaError(502, "Idea interpretation is temporarily unavailable. Please try again."));
  expect((await interpretRoute(request({ text: "Idea" }))).status).toBe(502);
  expect(createIdea).not.toHaveBeenCalled();
});
test("GET uses authenticated workspace and unexpected database errors are sanitized", async () => {
  listIdeas.mockResolvedValue([]);
  expect(await (await GET(request(null, { method: "GET" }))).json()).toEqual([]);
  expect(listIdeas).toHaveBeenCalledWith("workspace-a");
  createIdea.mockRejectedValue(new Error("postgres://secret private prompt"));
  const response = await POST(request());
  expect(response.status).toBe(503); expect(await response.text()).not.toMatch(/secret|postgres|private/);
});
