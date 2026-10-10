import "next/dist/compiled/server-only";
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

/** Returns validated data; callers catch AiError and render its safe message. */
export async function generate<T>({ prompt, schema }: { prompt: AiPrompt; schema: z.ZodType<T> }): Promise<T> {
  const text = typeof prompt === "string" ? prompt : prompt.text;
  const stub = process.env.AI_STUB_DIR;
  let responseJsonSchema: unknown;
  try { responseJsonSchema = z.toJSONSchema(schema, { io: "input" }); }
  catch { throw new AiError("INVALID_SCHEMA"); }
  let client: GoogleGenAI | undefined;
  const model = process.env.GEMINI_MODEL?.trim();
  if (!stub) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey || !model) throw new AiError("NOT_CONFIGURED");
    try { client = new GoogleGenAI({ apiKey, vertexai: false, httpOptions: { timeout: 30000, retryOptions: { attempts: 1 } } }); }
    catch { throw new AiError("PROVIDER_ERROR"); }
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: string;
    if (stub) raw = await fixture(stub, typeof prompt === "string" ? undefined : prompt.stubKey);
    else {
      try {
        const response = await client!.models.generateContent({ model: model!, contents: text, config: {
          responseMimeType: "application/json", responseJsonSchema,
          ...(attempt ? { systemInstruction: "Return only JSON that exactly satisfies the supplied response schema." } : {}),
        } });
        raw = response.text ?? "";
      } catch { throw new AiError("PROVIDER_ERROR"); }
    }
    try {
      const parsed = await schema.safeParseAsync(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    } catch { /* Invalid JSON or schema refinement: retry once without echoing raw data. */ }
  }
  throw new AiError("INVALID_OUTPUT");
}
