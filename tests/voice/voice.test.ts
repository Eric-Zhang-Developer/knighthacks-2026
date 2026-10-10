import { beforeEach, expect, test, vi } from "vitest";
import { appendUtterance } from "@/lib/voice/draft";
import { LIVE_TALK_COPY, liveTalkState, type LiveTalkState } from "@/components/voice/state";

const create = vi.fn();
vi.mock("@elevenlabs/elevenlabs-js", () => ({
  ElevenLabsClient: class {
    tokens = { singleUse: { create } };
  },
}));

const { POST } = await import("@/app/api/voice/token/route");

beforeEach(() => {
  create.mockReset();
  vi.unstubAllEnvs();
});

test("a released utterance joins the draft; blank ones leave it alone", () => {
  expect(appendUtterance("", "  a map of hackathons ")).toBe("a map of hackathons");
  expect(appendUtterance("a map", "for judges")).toBe("a map for judges");
  expect(appendUtterance("a map", "   ")).toBe("a map");
});

test("the live talk control exposes every state without inventing provider behavior", () => {
  const cases: Array<[LiveTalkState, Parameters<typeof liveTalkState>[0]]> = [
    ["idle", { notice: null, holding: false, status: "disconnected", partialTranscript: "" }],
    ["thinking", { notice: null, holding: true, status: "connecting", partialTranscript: "" }],
    ["listening", { notice: null, holding: true, status: "connected", partialTranscript: "" }],
    ["speaking", { notice: null, holding: true, status: "transcribing", partialTranscript: "hello" }],
    ["error", { notice: "blocked", holding: false, status: "disconnected", partialTranscript: "" }],
  ];

  for (const [expected, input] of cases) {
    expect(liveTalkState(input)).toBe(expected);
    expect(LIVE_TALK_COPY[expected].label.toLowerCase()).toBe(expected);
    expect(LIVE_TALK_COPY[expected].detail).not.toHaveLength(0);
  }
});

test("token route mints a realtime_scribe token and never returns the key", async () => {
  vi.stubEnv("ELEVENLABS_API_KEY", "sk_secret_key");
  create.mockResolvedValue({ token: "single-use-123" });
  const res = await POST();
  expect(res.status).toBe(200);
  expect(create).toHaveBeenCalledWith("realtime_scribe");
  const body = await res.text();
  expect(JSON.parse(body)).toEqual({ token: "single-use-123" });
  expect(body).not.toContain("sk_secret_key");
});

test("token route answers 503 without a key or when the provider fails", async () => {
  vi.stubEnv("ELEVENLABS_API_KEY", "");
  expect((await POST()).status).toBe(503);
  expect(create).not.toHaveBeenCalled();

  vi.stubEnv("ELEVENLABS_API_KEY", "sk_secret_key");
  create.mockRejectedValue(new Error("provider down"));
  const res = await POST();
  expect(res.status).toBe(503);
  expect(await res.text()).not.toContain("sk_secret_key");
});
