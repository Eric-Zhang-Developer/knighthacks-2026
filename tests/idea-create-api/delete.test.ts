import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
const { lookupSession, deleteIdea } = vi.hoisted(() => ({ lookupSession: vi.fn(), deleteIdea: vi.fn() }));
vi.mock("@/lib/workspace/service", () => ({ lookupSession }));
vi.mock("@/lib/ideas/service", () => ({ deleteIdea }));
import { DELETE } from "@/app/api/ideas/[ideaId]/route";
import { COOKIE } from "@/lib/workspace/tokens";
import { IdeaError } from "@/lib/ideas/contract";

const ideaId = "10000000-0000-4000-8000-000000000001";
const context = (id = ideaId) => ({ params: Promise.resolve({ ideaId: id }) });
const request = (cookie = true, origin = "https://uncharted.test") => new NextRequest(
  `https://uncharted.test/api/ideas/${ideaId}`, { method: "DELETE", headers: {
    origin, ...(cookie ? { cookie: `${COOKIE}=${"a".repeat(43)}` } : {}),
  } });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("DATABASE_URL", "test-database");
  vi.stubEnv("TEST_DATABASE_URL", "test-database");
  lookupSession.mockResolvedValue({ workspaceId: "workspace-a", memberId: "member-a" });
});
afterEach(() => vi.unstubAllEnvs());

test.each([undefined, "", " ", "another-database"])("unapproved database configuration prevents deletion (%s)", async (testDatabase) => {
  vi.stubEnv("TEST_DATABASE_URL", testDatabase);
  const response = await DELETE(request(), context());
  expect(response.status).toBe(503);
  expect(deleteIdea).not.toHaveBeenCalled();
  expect(await response.text()).not.toMatch(/test-database|another-database|DATABASE_URL/);
});

test("deletion uses the authenticated workspace and returns a no-store committed receipt", async () => {
  deleteIdea.mockResolvedValue({ ideaId, deleted: true });
  const response = await DELETE(request(), context());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ ideaId, deleted: true });
  expect(deleteIdea).toHaveBeenCalledExactlyOnceWith("workspace-a", ideaId);
});
test("anonymous, cross-origin and malformed IDs cannot call deletion", async () => {
  expect((await DELETE(request(false), context())).status).toBe(401);
  expect((await DELETE(request(true, "https://other.test"), context())).status).toBe(403);
  expect((await DELETE(request(), context("invalid"))).status).toBe(404);
  expect(deleteIdea).not.toHaveBeenCalled();
});
test("missing, foreign and repeated IDs have the same safe response", async () => {
  deleteIdea.mockRejectedValue(new IdeaError(404, "Idea not found"));
  const response = await DELETE(request(), context());
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: "Idea not found" });
});
test("database failure never claims success or leaks private details", async () => {
  deleteIdea.mockRejectedValue(new Error("postgres://secret dependent constraint"));
  const response = await DELETE(request(), context());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toMatch(/secret|postgres|constraint|deleted/);
});
