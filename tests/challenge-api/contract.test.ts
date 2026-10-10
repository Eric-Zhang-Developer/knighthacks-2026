import { afterEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@google/genai", () => ({ GoogleGenAI: class { models = { generateContent: call }; } }));
import { questionSchema, groundedSource } from "@/lib/challenge/contract";
import { generate } from "@/lib/ai/generate";
const sources = [{ id: "real", excerpt: "A real stored excerpt." }];
const good = { question: "How would you test demand?", assumption: "Users need this workflow", source: { text: "real stored excerpt", label: "supported" as const, sourceIds: ["real"] }, test: null };
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
test("dynamic grounding converts through both provider schema adapters", () => {
  const schema = questionSchema(sources);
  expect(z.toJSONSchema(schema)).toHaveProperty("properties.question");
  expect(zodOutputFormat(schema)).toHaveProperty("type", "json_schema");
  expect(schema.safeParse(good).success).toBe(true);
});
test.each([
  { ...good, assumption: " " }, { ...good, source: { ...good.source, sourceIds: ["invented"] } },
  { ...good, source: { ...good.source, text: "unsupported claim" } },
  { ...good, source: { ...good.source, sourceIds: [] } },
])("invalid grounding is rejected (%#)", (value) => { expect(questionSchema(sources).safeParse(value).success).toBe(false); });
test("a source-free named test is visibly unverified even when the model labels it supported", () => {
  const value = { ...good, test: "Interview five target users", source: { ...good.source, sourceIds: [] } };
  expect(questionSchema([]).safeParse(value).success).toBe(true);
  expect(groundedSource(value.source, value.test, [])).toEqual({ text: "Proposed test: Interview five target users", label: "unverified", sourceIds: [] });
});
test("actual shared generation retries grounding once, then ends on a second invalid result", async () => {
  vi.stubEnv("AI_STUB_DIR", ""); vi.stubEnv("ANTHROPIC_API_KEY", ""); vi.stubEnv("ANTHROPIC_MODEL", "");
  vi.stubEnv("GEMINI_API_KEY", "unit-only"); vi.stubEnv("GEMINI_MODEL", "unit-only");
  const schema = questionSchema(sources);
  call.mockResolvedValueOnce({ text: JSON.stringify({ ...good, assumption: "" }) }).mockResolvedValueOnce({ text: JSON.stringify(good) });
  expect(await generate({ schema, prompt: "Unit test" })).toEqual(good); expect(call).toHaveBeenCalledTimes(2);
  call.mockReset(); call.mockResolvedValue({ text: JSON.stringify({ ...good, assumption: "" }) });
  await expect(generate({ schema, prompt: "Unit test" })).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  expect(call).toHaveBeenCalledTimes(2);
});
