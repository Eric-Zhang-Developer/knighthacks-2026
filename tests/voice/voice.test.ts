import { beforeEach, expect, test, vi } from "vitest";
import { appendUtterance } from "@/lib/voice/draft";
import { NextRequest } from "next/server";

const create = vi.fn();
vi.mock("@/lib/workspace/require", () => ({ requireWorkspace: vi.fn().mockResolvedValue({ memberId: "member-1", workspaceId: "workspace-1" }) }));
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
  const body = await res.text();
  expect(JSON.parse(body)).toEqual({ token: "single-use-123" });
  expect(body).not.toContain("sk_secret_key");
});

test("token route answers 503 without a key or when the provider fails", async () => {
  vi.stubEnv("ELEVENLABS_API_KEY", "");
  expect((await POST(request())).status).toBe(503);
  expect(create).not.toHaveBeenCalled();

  vi.stubEnv("ELEVENLABS_API_KEY", "sk_secret_key");
  create.mockRejectedValue(new Error("provider down"));
  const res = await POST(request());
  expect(res.status).toBe(503);
  expect(await res.text()).not.toContain("sk_secret_key");
});

test("repeated authenticated requests are not stopped by an application quota", async () => {
  vi.stubEnv("ELEVENLABS_API_KEY", "sk_secret_key");
  create.mockResolvedValue({ token: "single-use-123" });
  const responses = await Promise.all(Array.from({ length: 25 }, () => POST(request())));
  expect(responses.every((response) => response.status === 200)).toBe(true);
  expect(responses.every((response) => response.headers.get("cache-control") === "no-store")).toBe(true);
  expect(create).toHaveBeenCalledTimes(25);
});

test("cross-origin requests are denied before contacting the provider", async () => {
  vi.stubEnv("ELEVENLABS_API_KEY", "sk_secret_key");
  expect((await POST(request("https://attacker.test"))).status).toBe(403);
  expect(create).not.toHaveBeenCalled();
});
