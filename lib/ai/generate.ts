import "next/dist/compiled/server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GoogleGenAI } from "@google/genai";
import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { z } from "zod";
import { checkImage, type AiImage } from "./image";

export type AiErrorCode = "NOT_CONFIGURED" | "PROVIDER_ERROR" | "INVALID_OUTPUT" | "INVALID_SCHEMA" | "STUB_UNAVAILABLE" | "INVALID_IMAGE" | "IMAGE_UNSUPPORTED" | "IMAGE_UNREADABLE";
const messages: Record<AiErrorCode, string> = {
  NOT_CONFIGURED: "AI generation is not configured.",
  PROVIDER_ERROR: "AI generation is temporarily unavailable. Please try again.",
  INVALID_OUTPUT: "AI returned an invalid response. Please try again.",
  INVALID_SCHEMA: "This AI request could not be validated.",
  STUB_UNAVAILABLE: "The AI test fixture is unavailable.",
  INVALID_IMAGE: "Use one PNG or JPEG image of 2 MB or less.",
  IMAGE_UNSUPPORTED: "The AI model can't read images right now. Paste the brief's text instead.",
  IMAGE_UNREADABLE: "No text could be read from this image. Try a sharper screenshot, or paste the text.",
};
/** Safe to display: never retains provider errors, prompts, keys, or fixture paths. */
export class AiError extends Error {
  readonly name = "AiError";
  constructor(readonly code: AiErrorCode) { super(messages[code]); }
}
export type AiPrompt = string | { text: string; stubKey?: string; image?: AiImage };

export async function fixture(directory: string, key: string | undefined): Promise<string> {
  if ((process.env.NODE_ENV !== "test" && process.env.AI_STUB_ALLOW !== "1") || process.env.VERCEL || !key || !/^[a-zA-Z0-9_-]{1,80}$/.test(key)) throw new AiError("STUB_UNAVAILABLE");
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

/** Gemini keys in order: the main key, then GEMINI_API_KEY_SPARE for when the main one is out of credits. */
export function geminiKeys(): string[] {
  return [process.env.GEMINI_API_KEY?.trim(), process.env.GEMINI_API_KEY_SPARE?.trim()].filter((k): k is string => !!k);
}

/** Configured providers, preferred first: Claude unless AI_PROVIDER=gemini; the other is the fallback. */
// A 400 that names images (or input modality / media type) on an image request means this model can't take it: a
// capability failure, never a quiet text-only answer. Any other 400 (a missing workspace header, a bad key) is an
// ordinary provider error. The message is only tested, never kept.
const failure = (image: AiImage | undefined, error: unknown) => {
  const e = error as { status?: number; message?: unknown } | null;
  const aboutImages = e?.status === 400 && /image|modalit|media.?type|mime/i.test(String(e.message ?? ""));
  return new AiError(image && aboutImages ? "IMAGE_UNSUPPORTED" : "PROVIDER_ERROR");
};

function providers(text: string, image: AiImage | undefined, schema: z.ZodType, responseJsonSchema: unknown): Call[] {
  const base64 = image && Buffer.from(image.data).toString("base64");
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim(), anthropicModel = process.env.ANTHROPIC_MODEL?.trim();
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  const geminiModel = process.env.GEMINI_MODEL?.trim();
  const anthropic: Call | undefined = anthropicKey && anthropicModel ? async (attempt) => {
    let response: Anthropic.Message;
    try {
      // Same JSON Schema as Gemini; the helper strips keywords the API rejects (zod re-checks them below).
      const format = zodOutputFormat(schema);
      response = await new Anthropic({ apiKey: anthropicKey, timeout: 60000, maxRetries: 0,
        // A key not scoped to a workspace is rejected unless the request names one.
        ...(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {}) }).messages.create({
        model: anthropicModel, max_tokens: 16000, output_config: { format },
        messages: [{ role: "user", content: image ? [{ type: "image", source: { type: "base64", media_type: image.mediaType, data: base64! } }, { type: "text", text }] : text }],
        ...(attempt ? { system: RETRY_INSTRUCTION } : {}),
      });
    } catch (error) { throw failure(image, error); }
    if (response.stop_reason === "refusal") throw new AiError("PROVIDER_ERROR");
    return response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
  } : undefined;
  // One call per key: spent credits on the main key raise PROVIDER_ERROR, which falls through to the spare.
  const gemini: Call[] = geminiModel ? geminiKeys().map((geminiKey) => async (attempt: number) => {
    try {
      // The SDK also sends this as Google's server deadline; rubric generation can take over 30 seconds.
      const client = new GoogleGenAI({ apiKey: geminiKey, vertexai: false, httpOptions: { timeout: 90000, retryOptions: { attempts: 1 } } });
      const contents = image ? [{ role: "user", parts: [{ inlineData: { mimeType: image.mediaType, data: base64! } }, { text }] }] : text;
      const response = await client.models.generateContent({ model: geminiModel, contents, config: {
        responseMimeType: "application/json", responseJsonSchema, ...(attempt ? { systemInstruction: RETRY_INSTRUCTION } : {}),
      } });
      return response.text ?? "";
    } catch (error) { throw failure(image, error); }
  }) : [];
  const order = process.env.AI_PROVIDER?.trim() === "gemini" ? [...gemini, anthropic] : [anthropic, ...gemini];
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
  // Checked here too, before a fixture or any provider, so no caller can hand a provider unchecked bytes.
  const image = typeof prompt === "string" || !prompt.image ? undefined : checkImage(prompt.image);
  const stub = process.env.AI_STUB_DIR;
  let responseJsonSchema: unknown;
  try { responseJsonSchema = z.toJSONSchema(schema, { io: "input" }); }
  catch { throw new AiError("INVALID_SCHEMA"); }
  if (stub) return attempts(() => fixture(stub, typeof prompt === "string" ? undefined : prompt.stubKey), schema);
  const calls = providers(text, image, schema, responseJsonSchema);
  if (!calls.length) throw new AiError("NOT_CONFIGURED");
  // An outage, rate limit or spent credits on the preferred provider falls through to the other one; so does a model
  // that can't take the image, with the same image. If none can, the last failure is the one reported.
  for (const [i, call] of calls.entries()) {
    try { return await attempts(call, schema); }
    catch (error) { if (!(error instanceof AiError && (error.code === "PROVIDER_ERROR" || error.code === "IMAGE_UNSUPPORTED") && i < calls.length - 1)) throw error; }
  }
  throw new AiError("PROVIDER_ERROR");
}
