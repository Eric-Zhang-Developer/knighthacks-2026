import "next/dist/compiled/server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GoogleGenAI } from "@google/genai";
import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { z } from "zod";

export type AiErrorCode = "NOT_CONFIGURED" | "PROVIDER_ERROR" | "INVALID_OUTPUT" | "INVALID_SCHEMA" | "STUB_UNAVAILABLE";
const messages: Record<AiErrorCode, string> = {
  NOT_CONFIGURED: "AI generation is not configured.",
  PROVIDER_ERROR: "AI generation is temporarily unavailable. Please try again.",
  INVALID_OUTPUT: "AI returned an invalid response. Please try again.",
  INVALID_SCHEMA: "This AI request could not be validated.",
  STUB_UNAVAILABLE: "The AI test fixture is unavailable.",
};
/** Safe to display: never retains provider errors, prompts, keys, or fixture paths. */
export class AiError extends Error {
  readonly name = "AiError";
  constructor(readonly code: AiErrorCode) { super(messages[code]); }
}
export type AiPrompt = string | { text: string; stubKey?: string };

async function fixture(directory: string, key: string | undefined): Promise<string> {
  if (process.env.NODE_ENV !== "test" || process.env.VERCEL || !key || !/^[a-zA-Z0-9_-]{1,80}$/.test(key)) throw new AiError("STUB_UNAVAILABLE");
  try {
    const root = await realpath(directory);
    const file = await realpath(resolve(root, `${key}.json`));
    const inside = relative(root, file);
    if (inside.startsWith("..") || isAbsolute(inside) || (await stat(file)).size > 65536) throw new Error();
    return await readFile(file, "utf8");
  } catch { throw new AiError("STUB_UNAVAILABLE"); }
}

/** One provider attempt: returns the raw JSON text, or throws a safe AiError. */
type Call = (attempt: number) => Promise<string>;
const RETRY_INSTRUCTION = "Return only JSON that exactly satisfies the supplied response schema.";

/** Configured providers, preferred first: Claude unless AI_PROVIDER=gemini; the other is the fallback. */
function providers(text: string, schema: z.ZodType, responseJsonSchema: unknown): Call[] {
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim(), anthropicModel = process.env.ANTHROPIC_MODEL?.trim();
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim(), geminiModel = process.env.GEMINI_MODEL?.trim();
  const anthropic: Call | undefined = anthropicKey && anthropicModel ? async (attempt) => {
    let response: Anthropic.Message;
    try {
      // Same JSON Schema as Gemini; the helper strips keywords the API rejects (zod re-checks them below).
      const format = zodOutputFormat(schema);
      response = await new Anthropic({ apiKey: anthropicKey, timeout: 60000, maxRetries: 0,
        // A key not scoped to a workspace is rejected unless the request names one.
        ...(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {}) }).messages.create({
        model: anthropicModel, max_tokens: 16000, messages: [{ role: "user", content: text }], output_config: { format },
        ...(attempt ? { system: RETRY_INSTRUCTION } : {}),
      });
    } catch { throw new AiError("PROVIDER_ERROR"); }
    if (response.stop_reason === "refusal") throw new AiError("PROVIDER_ERROR");
    return response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
  } : undefined;
  const gemini: Call | undefined = geminiKey && geminiModel ? async (attempt) => {
    try {
      const client = new GoogleGenAI({ apiKey: geminiKey, vertexai: false, httpOptions: { timeout: 30000, retryOptions: { attempts: 1 } } });
      const response = await client.models.generateContent({ model: geminiModel, contents: text, config: {
        responseMimeType: "application/json", responseJsonSchema, ...(attempt ? { systemInstruction: RETRY_INSTRUCTION } : {}),
      } });
      return response.text ?? "";
    } catch { throw new AiError("PROVIDER_ERROR"); }
  } : undefined;
  const order = process.env.AI_PROVIDER?.trim() === "gemini" ? [gemini, anthropic] : [anthropic, gemini];
  return order.filter((call): call is Call => call !== undefined);
}

async function attempts<T>(call: Call, schema: z.ZodType<T>): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await call(attempt);
    try {
      const parsed = await schema.safeParseAsync(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    } catch { /* Invalid JSON or schema refinement: retry once without echoing raw data. */ }
  }
  throw new AiError("INVALID_OUTPUT");
}

/** Returns validated data; callers catch AiError and render its safe message. */
export async function generate<T>({ prompt, schema }: { prompt: AiPrompt; schema: z.ZodType<T> }): Promise<T> {
  const text = typeof prompt === "string" ? prompt : prompt.text;
  const stub = process.env.AI_STUB_DIR;
  let responseJsonSchema: unknown;
  try { responseJsonSchema = z.toJSONSchema(schema, { io: "input" }); }
  catch { throw new AiError("INVALID_SCHEMA"); }
  if (stub) return attempts(() => fixture(stub, typeof prompt === "string" ? undefined : prompt.stubKey), schema);
  const calls = providers(text, schema, responseJsonSchema);
  if (!calls.length) throw new AiError("NOT_CONFIGURED");
  // An outage, rate limit or spent credits on the preferred provider falls through to the other one.
  for (const [i, call] of calls.entries()) {
    try { return await attempts(call, schema); }
    catch (error) { if (!(error instanceof AiError && error.code === "PROVIDER_ERROR" && i < calls.length - 1)) throw error; }
  }
  throw new AiError("PROVIDER_ERROR");
}
