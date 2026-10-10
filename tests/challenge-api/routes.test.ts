import { beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
const { lookupSession, start, round, answer } = vi.hoisted(() => ({ lookupSession: vi.fn(), start: vi.fn(), round: vi.fn(), answer: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@/lib/workspace/service", () => ({ lookupSession }));
vi.mock("@/lib/challenge/service", () => ({ start, round, answer }));
import { POST } from "@/app/api/challenge/route";
import { POST as nextRound } from "@/app/api/challenge/[sessionId]/round/route";
import { POST as answerRoute } from "@/app/api/challenge/[sessionId]/answer/route";
import { COOKIE } from "@/lib/workspace/tokens";
const id = "00000000-0000-4000-8000-000000000001", context = { params: Promise.resolve({ sessionId: id }) };
function request(body?: unknown, auth = true, origin = "https://uncharted.test") {
  return new NextRequest("https://uncharted.test/api/challenge", { method: "POST", headers: { origin, "content-type": "application/json", ...(auth ? { cookie: `${COOKIE}=${"a".repeat(43)}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
beforeEach(() => { vi.resetAllMocks(); lookupSession.mockResolvedValue({ workspaceId: "workspace", memberId: "member" }); start.mockResolvedValue({ sessionId: id, versionId: id, perspective: "user" }); round.mockResolvedValue({ round: 1 }); answer.mockResolvedValue({ outcome: "test" }); });
test("creation uses authenticated workspace and no-store status201", async () => {
  const response = await POST(request({ versionId: id, perspective: "user" }));
  expect(response.status).toBe(201); expect(response.headers.get("cache-control")).toBe("no-store");
  expect(start).toHaveBeenCalledWith("workspace", id, "user");
});
test("authentication/origin failures stop all operations", async () => {
  expect((await POST(request({}, false))).status).toBe(401);
  expect((await nextRound(request(undefined, false), context)).status).toBe(401);
  expect((await answerRoute(request({ answer: "test" }, true, "https://foreign.test"), context)).status).toBe(403);
  expect(start).not.toHaveBeenCalled(); expect(round).not.toHaveBeenCalled(); expect(answer).not.toHaveBeenCalled();
});
test("invalid perspective/IDs/answers and nonempty round body are rejected", async () => {
  expect((await POST(request({ versionId: id, perspective: "invented" }))).status).toBe(400);
  expect((await nextRound(request(), { params: Promise.resolve({ sessionId: "bad" }) })).status).toBe(400);
  expect((await nextRound(request({}), context)).status).toBe(400);
  expect((await answerRoute(request({ answer: " " }), context)).status).toBe(400);
  expect((await answerRoute(request({ answer: "x".repeat(8001) }), context)).status).toBe(400);
  expect(round).not.toHaveBeenCalled(); expect(answer).not.toHaveBeenCalled();
});
test("empty HTTP stream is accepted and raw service errors are sanitized", async () => {
  const req = new NextRequest("https://uncharted.test/api/challenge", { method: "POST", headers: { origin: "https://uncharted.test", cookie: `${COOKIE}=${"a".repeat(43)}` }, body: new ReadableStream({ start(c) { c.close(); } }), duplex: "half" } as ConstructorParameters<typeof NextRequest>[1]);
  expect((await nextRound(req, context)).status).toBe(200);
  answer.mockRejectedValueOnce(new Error("postgres://secret"));
  const response = await answerRoute(request({ answer: "actual answer" }), context);
  expect(response.status).toBe(503); expect(await response.text()).not.toContain("secret");
});
