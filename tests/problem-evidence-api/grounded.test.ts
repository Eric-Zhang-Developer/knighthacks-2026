import { afterEach, beforeEach, expect, test, vi } from "vitest";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@google/genai", () => ({ GoogleGenAI: class { models = { generateContent: call }; } }));
import { groundedSearch } from "@/lib/ai/grounded";
import { eventDate } from "@/lib/problem-evidence/contract";
import { publishedAt, publicAddress, resolveSource } from "@/lib/problem-evidence/page";
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("GEMINI_API_KEY", "test"); vi.stubEnv("GEMINI_MODEL", "test-model"); vi.stubEnv("AI_STUB_DIR", ""); });
afterEach(() => vi.unstubAllEnvs());
test("search requests grounding without schema and drops unsupported text and bad citations", async () => {
  call.mockResolvedValue({ text: "A grounded finding. Ungrounded prose.", candidates: [{ groundingMetadata: {
    groundingChunks: [{ web: { uri: "https://example.org/report", title: "Report" } }],
    groundingSupports: [{ segment: { text: "A grounded finding." }, groundingChunkIndices: [0, 5] },
      { segment: { text: "Invented support" }, groundingChunkIndices: [0] }],
  } }] });
  const result = await groundedSearch("problem");
  expect(call.mock.calls[0][0]).toEqual({ model: "test-model", contents: "problem", config: { tools: [{ googleSearch: {} }] } });
  expect(result.groundingSupports).toEqual([{ text: "A grounded finding.", chunkIndices: [0] }]);
});
test("no key or no grounding is a typed failure without fallback", async () => {
  vi.stubEnv("GEMINI_API_KEY", ""); vi.stubEnv("ANTHROPIC_API_KEY", "configured");
  await expect(groundedSearch("problem")).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
  expect(call).not.toHaveBeenCalled(); vi.stubEnv("GEMINI_API_KEY", "test");
  call.mockResolvedValue({ text: "No sources" });
  await expect(groundedSearch("problem")).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  call.mockRejectedValue(new Error("private key"));
  await expect(groundedSearch("problem")).rejects.toMatchObject({ code: "PROVIDER_ERROR", message: "AI generation is temporarily unavailable. Please try again." });
});
test.each([["Reported in March 2025.", "March 2025"], ["As of March 2, 2025.", "March 2, 2025"], ["On 2025-03-02", "2025-03-02"], ["In 2024.", "2024"], ["No date mentioned", null]])("copies date text: %s", (text, date) => expect(eventDate(text)).toBe(date));
test("page dates require explicit metadata", () => {
  expect(publishedAt("<p>Published in March 2025</p>")).toBeNull();
  expect(publishedAt('<meta content="2025-03-02" property="article:published_time">')).toBe("2025-03-02");
  expect(publishedAt('<script type="application/ld+json">{"@graph":[{"datePublished":"2025-03-03T00:00:00Z"}]}</script>')).toBe("2025-03-03T00:00:00Z");
});
test.each(["127.0.0.1", "10.0.0.1", "169.254.169.254", "100.64.0.1", "192.168.0.1", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "2002:7f00:1::"])('rejects non-public destination %s', async (address) => {
  expect(publicAddress(address)).toBe(false);
  expect(await resolveSource(`http://${address.includes(":") ? `[${address}]` : address}/`, "unused")).toEqual({ url: null, publishedAt: null });
});
test("public destinations are eligible", () => { expect(publicAddress("8.8.8.8")).toBe(true); expect(publicAddress("2606:4700::1111")).toBe(true); });
