import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { resolve } from "node:path";
import { z } from "zod";
const { call, construct } = vi.hoisted(() => ({ call: vi.fn(), construct: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@google/genai", () => ({ GoogleGenAI: class { models = { generateContent: call }; constructor(options: unknown) { construct(options); } } }));
import { AiError, generate } from "@/lib/ai/generate";
import { checkClaims, type Claim } from "@/lib/ai/claims";
const schema = z.object({ message: z.string() });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("GEMINI_API_KEY", "test-secret"); vi.stubEnv("GEMINI_MODEL", "test-model");
  vi.stubEnv("AI_STUB_DIR", ""); vi.stubEnv("VERCEL", ""); vi.stubEnv("NODE_ENV", "test");
});
afterEach(() => vi.unstubAllEnvs());
test("validated generation uses configured model and JSON schema", async () => {
  call.mockResolvedValue({ text: '{"message":"ok"}' });
  expect(await generate({ prompt: "private prompt", schema })).toEqual({ message: "ok" });
  expect(call.mock.calls[0][0]).toMatchObject({ model: "test-model", config: { responseMimeType: "application/json" } });
  expect(construct.mock.calls[0][0]).toMatchObject({ httpOptions: { retryOptions: { attempts: 1 } } });
});
test.each(["not-json", '{"message":42}'])("retries invalid output exactly once: %s", async (bad) => {
  call.mockResolvedValueOnce({ text: bad }).mockResolvedValueOnce({ text: '{"message":"fixed"}' });
  expect(await generate({ prompt: "private", schema })).toEqual({ message: "fixed" });
  expect(call).toHaveBeenCalledTimes(2);
});
test("two invalid outputs produce a safe typed error", async () => {
  call.mockResolvedValue({ text: "private provider content" });
  await expect(generate({ prompt: "private", schema })).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  expect(call).toHaveBeenCalledTimes(2);
});
test("missing configuration and provider failures are safe typed errors", async () => {
  vi.stubEnv("GEMINI_API_KEY", "");
  await expect(generate({ prompt: "private", schema })).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
  expect(call).not.toHaveBeenCalled();
  vi.stubEnv("GEMINI_API_KEY", "test-secret"); vi.stubEnv("GEMINI_MODEL", "");
  await expect(generate({ prompt: "private", schema })).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
  vi.stubEnv("GEMINI_MODEL", "test-model"); call.mockRejectedValue(new Error("test-secret private"));
  try { await generate({ prompt: "private", schema }); throw new Error("Expected failure"); }
  catch (error) { expect(error).toBeInstanceOf(AiError); expect(String(error)).not.toMatch(/test-secret|private/); expect(error).not.toHaveProperty("cause"); }
  expect(call).toHaveBeenCalledTimes(1);
});
test("fixture mode validates output and rejects unsafe lookup and production use", async () => {
  vi.stubEnv("AI_STUB_DIR", resolve("tests/ai-client/fixtures"));
  expect(await generate({ prompt: { text: "fixture", stubKey: "smoke" }, schema })).toEqual({ message: "AI client fixture verified" });
  await expect(generate({ prompt: { text: "fixture", stubKey: "../smoke" }, schema })).rejects.toMatchObject({ code: "STUB_UNAVAILABLE" });
  await expect(generate({ prompt: { text: "fixture", stubKey: "missing" }, schema })).rejects.toMatchObject({ code: "STUB_UNAVAILABLE" });
  await expect(generate({ prompt: { text: "fixture", stubKey: "smoke" }, schema: z.object({ count: z.number() }) })).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  vi.stubEnv("NODE_ENV", "production");
  await expect(generate({ prompt: { text: "fixture", stubKey: "smoke" }, schema })).rejects.toMatchObject({ code: "STUB_UNAVAILABLE" });
  expect(call).not.toHaveBeenCalled();
});
test("claim checks only downgrade unsupported provenance and never mutate input", () => {
  const claims: Claim[] = [
    { text: "none", label: "supported", sourceIds: [] },
    { text: "mixed", label: "supported", sourceIds: ["known", "unknown"] },
    { text: "known", label: "supported", sourceIds: ["known"] },
    { text: "inference", label: "inferred", sourceIds: ["known"] },
    { text: "unchecked", label: "unverified", sourceIds: ["known"] },
  ];
  const checked = checkClaims(claims, new Set(["known"]));
  expect(checked.map((c) => c.label)).toEqual(["unverified", "unverified", "supported", "inferred", "unverified"]);
  expect(claims[0].label).toBe("supported");
  checked[2].sourceIds.push("other"); expect(claims[2].sourceIds).toEqual(["known"]);
});
