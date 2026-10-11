import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ token: vi.fn(), create: vi.fn(), update: vi.fn(), get: vi.fn(), list: vi.fn(), constructor: vi.fn() }));
vi.mock("@elevenlabs/elevenlabs-js", () => {
  return { ElevenLabs: { Llm: { Gpt4OMini: "gpt-4o-mini" } }, ElevenLabsClient: class {
    constructor(options: unknown) { mocks.constructor(options); }
    conversationalAi = { conversations: { getWebrtcToken: mocks.token }, agents: { create: mocks.create, update: mocks.update, get: mocks.get, list: mocks.list } };
  } };
});
import { configuredAgent, mintConversationToken } from "@/lib/mentor/provider";
import { buildAgentDefinition, MENTOR_AGENT_NAME, MENTOR_AGENT_TAG, PROGRESSIVE_BRAINSTORMING_POLICY, MENTOR_CONVERSATION_STYLE_POLICY, MENTOR_QUALITY_POLICY, MENTOR_POLICY_START } from "@/lib/mentor/agent-config";
import { setupMentor } from "@/lib/mentor/setup";

const setupEnv = {
  ELEVENLABS_API_KEY: "secret-test-key", ELEVENLABS_MENTOR_MODEL: "gpt-4o-mini", ELEVENLABS_MENTOR_VOICE_ID: "test-voice",
  ELEVENLABS_MENTOR_RETENTION_DAYS: "0", ELEVENLABS_MENTOR_RECORD_VOICE: "false",
  ELEVENLABS_MENTOR_DELETE_TRANSCRIPT_AND_PII: "true", ELEVENLABS_MENTOR_DELETE_AUDIO: "true", ELEVENLABS_MENTOR_ZERO_RETENTION: "true",
};
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("ELEVENLABS_API_KEY", "secret-test-key"); vi.stubEnv("ELEVENLABS_MENTOR_AGENT_ID", "agent_test"); });
afterEach(() => vi.unstubAllEnvs());

describe("private mentor capabilities", () => {
  it("rejects missing server configuration before contacting the provider", async () => {
    vi.stubEnv("ELEVENLABS_MENTOR_AGENT_ID", "");
    expect(configuredAgent).toThrow();
    await expect(mintConversationToken()).rejects.toMatchObject({ status: 503 });
    expect(mocks.constructor).not.toHaveBeenCalled();
  });
  it("mints only for the server configured agent without provider retries", async () => {
    mocks.token.mockResolvedValue({ token: "private-capability" });
    await expect(mintConversationToken()).resolves.toBe("private-capability");
    expect(mocks.token).toHaveBeenCalledWith({ agentId: "agent_test" }, { timeoutInSeconds: 15, maxRetries: 0 });
  });
  it.each([new Error("secret-test-key private-capability"), { status: 401, body: "private-capability" }])("redacts provider failures", async (failure) => {
    mocks.token.mockRejectedValue(failure);
    await expect(mintConversationToken()).rejects.toMatchObject({ status: 503, message: "The spoken mentor is unavailable. You can keep working with text." });
  });
  it("rejects a malformed provider capability", async () => {
    mocks.token.mockResolvedValue({ token: " " });
    await expect(mintConversationToken()).rejects.toMatchObject({ status: 503 });
  });
});

describe("explicit managed mentor setup", () => {
  it("deploys progressive evidence-first policy without granting a save tool", async () => {
    mocks.get.mockResolvedValue({ name: MENTOR_AGENT_NAME, tags: [MENTOR_AGENT_TAG] });
    await setupMentor(["--update"], { ...setupEnv, ELEVENLABS_MENTOR_AGENT_ID: "agent_test" });
    const definition = mocks.update.mock.calls[0][1];
    expect(definition.conversationConfig.agent.prompt.prompt).toContain(PROGRESSIVE_BRAINSTORMING_POLICY);
    expect(definition.conversationConfig.agent.prompt.prompt).toContain(MENTOR_CONVERSATION_STYLE_POLICY);
    expect(definition.conversationConfig.agent.prompt.tools.map((tool: { name: string }) => tool.name)).toEqual(["get_context", "find_projects", "search_recent_news", "propose_idea"]);
    expect(definition.platformSettings.auth.enableAuth).toBe(true);
    expect(definition.conversationConfig.conversation.maxDurationSeconds).toBe(7200);
  });
  it("preserves operator confirmation policy and replaces its own policy block idempotently", async () => {
    mocks.get.mockResolvedValue({ name: MENTOR_AGENT_NAME, tags: [MENTOR_AGENT_TAG], conversationConfig: { agent: { prompt: { prompt: "Operator rule: save idea two requires the exact second confirmation." } }, tts: { modelId: "operator-selected-tts" }, turn: { speculativeTurn: true } } });
    await setupMentor(["--update"], { ...setupEnv, ELEVENLABS_MENTOR_AGENT_ID: "agent_test" });
    expect(mocks.update.mock.calls[0][1].conversationConfig.tts.modelId).toBe("operator-selected-tts");
    expect(mocks.update.mock.calls[0][1].conversationConfig.turn.speculativeTurn).toBe(true);
    const first = mocks.update.mock.calls[0][1].conversationConfig.agent.prompt.prompt;
    expect(first).toContain("Operator rule: save idea two requires the exact second confirmation.");
    expect(first).toContain(MENTOR_QUALITY_POLICY);
    mocks.get.mockResolvedValue({ name: MENTOR_AGENT_NAME, tags: [MENTOR_AGENT_TAG], conversationConfig: { agent: { prompt: { prompt: first } } } });
    await setupMentor(["--update"], { ...setupEnv, ELEVENLABS_MENTOR_AGENT_ID: "agent_test" });
    const second = mocks.update.mock.calls[1][1].conversationConfig.agent.prompt.prompt;
    expect(second).toBe(first);
    expect(second.split(MENTOR_POLICY_START)).toHaveLength(2);
  });
  it("is provider-free by default and keeps privacy choices explicit", async () => {
    const result = await setupMentor([], setupEnv);
    expect(result.action).toBe("dry-run");
    expect(mocks.constructor).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("secret-test-key");
    const definition = buildAgentDefinition(setupEnv);
    expect(definition.platformSettings?.auth?.enableAuth).toBe(true);
    expect(definition.conversationConfig.conversation?.maxDurationSeconds).toBe(7200);
    expect(definition.conversationConfig.agent?.prompt?.tools?.map((tool) => "name" in tool ? tool.name : null)).toEqual(["get_context", "find_projects", "search_recent_news", "propose_idea"]);
    expect(() => buildAgentDefinition({ ...setupEnv, ELEVENLABS_MENTOR_RETENTION_DAYS: undefined })).toThrow();
  });
  it("refuses to overwrite an unrelated provider agent", async () => {
    mocks.get.mockResolvedValue({ name: "Other app", tags: [] });
    await expect(setupMentor(["--update"], { ...setupEnv, ELEVENLABS_MENTOR_AGENT_ID: "agent_test" })).rejects.toThrow();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("updates only the exact managed target", async () => {
    mocks.get.mockResolvedValue({ name: MENTOR_AGENT_NAME, tags: [MENTOR_AGENT_TAG] });
    await setupMentor(["--update"], { ...setupEnv, ELEVENLABS_MENTOR_AGENT_ID: "agent_test" });
    expect(mocks.update.mock.calls[0][0]).toBe("agent_test");
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("does not duplicate an existing tagged mentor on creation retry", async () => {
    mocks.list.mockResolvedValue({ agents: [{ agentId: "agent_existing" }], hasMore: false });
    await expect(setupMentor(["--create"], setupEnv)).rejects.toThrow();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
