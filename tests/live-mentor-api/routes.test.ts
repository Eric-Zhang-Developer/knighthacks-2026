import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocked = vi.hoisted(() => ({
  lookupSession: vi.fn(), configuredAgent: vi.fn(), mintConversationToken: vi.fn(),
  reserveSession: vi.fn(), endSession: vi.fn(), reserveTool: vi.fn(), completeTool: vi.fn(), failTool: vi.fn(), executeTool: vi.fn(),
}));
vi.mock("@/lib/workspace/service", () => ({ lookupSession: mocked.lookupSession }));
vi.mock("@/lib/mentor/provider", () => ({ configuredAgent: mocked.configuredAgent, mintConversationToken: mocked.mintConversationToken }));
vi.mock("@/lib/mentor/store", () => ({ reserveSession: mocked.reserveSession, endSession: mocked.endSession, reserveTool: mocked.reserveTool, completeTool: mocked.completeTool, failTool: mocked.failTool }));
vi.mock("@/lib/mentor/tools", () => ({ executeTool: mocked.executeTool }));
import { POST as session } from "@/app/api/mentor/session/route";
import { POST as tools } from "@/app/api/mentor/tools/route";
import { DELETE as end } from "@/app/api/mentor/session/[id]/route";
import { callIdFor, MentorError } from "@/lib/mentor/contract";

const sessionId = "d6d0df82-2a65-40cb-9520-9620393ad55f";
const identity = { workspaceId: "7d8f80ae-28c2-4d6f-979f-8fe1c0239ee6", memberId: "c2212c30-db75-4d3b-92ee-f9168939a47e" };
const payload = { sessionId, turnId: 1, tool: "get_context" as const, args: {} };
const call = { ...payload, callId: callIdFor(payload) };
function request(path: string, body: unknown, origin = "https://uncharted.test", method = "POST") {
  return new NextRequest(`https://uncharted.test/api/mentor/${path}`, { method,
    headers: { origin, "content-type": "application/json", cookie: `__Host-uncharted-session=${"a".repeat(43)}` },
    ...(method !== "DELETE" ? { body: JSON.stringify(body) } : {}),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocked.lookupSession.mockResolvedValue(identity);
  mocked.configuredAgent.mockReturnValue({ apiKey: "private", agentId: "agent_private" });
  mocked.mintConversationToken.mockResolvedValue("browser-only-capability");
  mocked.reserveSession.mockResolvedValue(sessionId);
  mocked.endSession.mockResolvedValue(undefined);
  mocked.reserveTool.mockResolvedValue({ status: "run", sourceIds: new Set() });
  mocked.completeTool.mockResolvedValue(undefined);
  mocked.failTool.mockResolvedValue(undefined);
  mocked.executeTool.mockResolvedValue({ saved: null, sourceIds: [] });
});

describe("mentor HTTP authorization and capability boundaries", () => {
  it("rejects unauthenticated and cross-origin requests before any provider reservation", async () => {
    mocked.lookupSession.mockResolvedValue(null);
    expect((await session(request("session", {}))).status).toBe(401);
    expect((await session(request("session", {}, "https://foreign.test"))).status).toBe(403);
    expect(mocked.reserveSession).not.toHaveBeenCalled();
    expect(mocked.mintConversationToken).not.toHaveBeenCalled();
  });
  it("only issues configured capabilities with no cache or cookie propagation", async () => {
    expect((await session(request("session", { agentId: "agent_attacker" }))).status).toBe(400);
    const response = await session(request("session", {}));
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toMatchObject({ sessionId, transport: "webrtc", conversationToken: "browser-only-capability" });
    expect(mocked.reserveSession).toHaveBeenCalledWith(identity);
  });
  it("ends failed issuance without refunding its reservation or exposing diagnostics", async () => {
    mocked.mintConversationToken.mockRejectedValue(new Error("API key and private upstream diagnostic"));
    const response = await session(request("session", {}));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private");
    expect(mocked.endSession).toHaveBeenCalledWith(identity, sessionId);
  });
  it("does not reserve a session when configuration is absent", async () => {
    mocked.configuredAgent.mockImplementation(() => { throw new MentorError(503, "Mentor unavailable"); });
    expect((await session(request("session", {}))).status).toBe(503);
    expect(mocked.reserveSession).not.toHaveBeenCalled();
  });
  it("passes the current member to end and refuses a foreign session", async () => {
    mocked.endSession.mockRejectedValue(new MentorError(404, "Mentor session not found"));
    const response = await end(request(`session/${sessionId}`, {}, undefined, "DELETE"), { params: Promise.resolve({ id: sessionId }) });
    expect(response.status).toBe(404);
    expect(mocked.endSession).toHaveBeenCalledWith(identity, sessionId);
  });
});

describe("mentor tool delivery", () => {
  it("rejects unknown tools, extra args, invalid call identities and large UTF8 bodies", async () => {
    expect((await tools(request("tools", { ...call, tool: "execute_sql" }))).status).toBe(400);
    expect((await tools(request("tools", { ...call, args: { url: "https://foreign.test" } }))).status).toBe(400);
    expect((await tools(request("tools", { ...call, callId: "0".repeat(64) }))).status).toBe(409);
    expect((await tools(request("tools", { text: "漢".repeat(6000) }))).status).toBe(413);
    expect(mocked.reserveTool).not.toHaveBeenCalled();
  });
  it("returns pending duplicates without executing again", async () => {
    mocked.reserveTool.mockResolvedValue({ status: "pending" });
    const response = await tools(request("tools", call));
    expect(response.status).toBe(202);
    expect(response.headers.get("retry-after")).toBe("1");
    expect(await response.json()).toMatchObject({ sessionId, turnId: 1, tool: "get_context", callId: call.callId, status: "pending" });
    expect(mocked.executeTool).not.toHaveBeenCalled();
  });
  it("replays the stored payload and preserves the same call/turn identity", async () => {
    mocked.reserveTool.mockResolvedValue({ status: "replay", data: { saved: null } });
    const response = await tools(request("tools", call));
    expect(await response.json()).toEqual({ sessionId, turnId: 1, callId: call.callId, tool: "get_context", data: { saved: null } });
    expect(mocked.executeTool).not.toHaveBeenCalled();
  });
  it("suppresses results completing after the session ended", async () => {
    mocked.completeTool.mockRejectedValue(new MentorError(410, "Mentor session ended"));
    const response = await tools(request("tools", call));
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ error: "Mentor session ended" });
    expect(mocked.failTool).toHaveBeenCalledWith(identity, call);
  });
  it("does not execute when the session store refuses the caller", async () => {
    mocked.reserveTool.mockRejectedValue(new MentorError(404, "Mentor session not found"));
    expect((await tools(request("tools", call))).status).toBe(404);
    expect(mocked.executeTool).not.toHaveBeenCalled();
  });
});
