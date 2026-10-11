import { beforeEach, expect, test, vi } from "vitest";
import { appendUtterance } from "@/lib/voice/draft";
import { NextRequest } from "next/server";

const create = vi.fn();
const reserve = vi.fn();
vi.mock("@/lib/workspace/require", () => ({ requireWorkspace: vi.fn().mockResolvedValue({ memberId: "member-1", workspaceId: "workspace-1" }) }));
vi.mock("@/lib/voice/rate-limit", () => ({ reserveVoiceToken: reserve, TOKEN_LIMIT: 10, TOKEN_WINDOW_SECONDS: 60 }));
vi.mock("@elevenlabs/elevenlabs-js", () => ({
  ElevenLabsClient: class {
    tokens = { singleUse: { create } };
  },
}));

const { POST } = await import("@/app/api/voice/token/route");
const request = (origin = "https://uncharted.test") => new NextRequest("https://uncharted.test/api/voice/token", {
  method: "POST", headers: { origin },
});

beforeEach(() => {
  create.mockReset();
  reserve.mockReset().mockResolvedValue(true);
  vi.unstubAllEnvs();
});

test("a released utterance joins the draft; blank ones leave it alone", () => {
  expect(appendUtterance("", "  a map of hackathons ")).toBe("a map of hackathons");
  expect(appendUtterance("a map", "for judges")).toBe("a map for judges");
  expect(appendUtterance("a map", "   ")).toBe("a map");
});

test("token route mints a realtime_scribe token and never returns the key", async () => {
  vi.stubEnv("ELEVENLABS_API_KEY", "sk_secret_key");
  create.mockResolvedValue({ token: "single-use-123" });
  const res = await POST(request());
  expect(res.status).toBe(200);
  expect(create).toHaveBeenCalledWith("realtime_scribe");
  expect(reserve).toHaveBeenCalledWith("member-1");
  expect(reserve.mock.invocationCallOrder[0]).toBeLessThan(create.mock.invocationCallOrder[0]);
  const body = await res.text();
  expect(JSON.parse(body)).toEqual({ token: "single-use-123" });
  expect(body).not.toContain("sk_secret_key");
});

test("token route answers 503 without a key or when the provider fails", async () => {
  vi.stubEnv("ELEVENLABS_API_KEY", "");
  expect((await POST(request())).status).toBe(503);
  expect(create).not.toHaveBeenCalled();
  expect(reserve).not.toHaveBeenCalled();

  vi.stubEnv("ELEVENLABS_API_KEY", "sk_secret_key");
  create.mockRejectedValue(new Error("provider down"));
  const res = await POST(request());
  expect(res.status).toBe(503);
  expect(await res.text()).not.toContain("sk_secret_key");
});

test("exhausted durable quota returns bounded retry headers without minting", async () => {
  vi.stubEnv("ELEVENLABS_API_KEY", "sk_secret_key");
  reserve.mockResolvedValue(false);
  const res = await POST(request());
  expect(res.status).toBe(429);
  expect(res.headers.get("retry-after")).toBe("60");
  expect(res.headers.get("x-ratelimit-limit")).toBe("10");
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(create).not.toHaveBeenCalled();
});

test("database failure fails closed and cross-origin requests spend no quota", async () => {
  vi.stubEnv("ELEVENLABS_API_KEY", "sk_secret_key");
  expect((await POST(request("https://attacker.test"))).status).toBe(403);
  expect(reserve).not.toHaveBeenCalled();
  reserve.mockRejectedValue(new Error("postgres://secret"));
  const res = await POST(request());
  expect(res.status).toBe(503);
  expect(await res.text()).not.toContain("postgres");
  expect(create).not.toHaveBeenCalled();
});
