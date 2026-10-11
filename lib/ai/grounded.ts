import "next/dist/compiled/server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { AiError, fixture, geminiKeys, type AiPrompt } from "./generate";

const grounding = z.object({
  text: z.string().min(1), model: z.string().min(1),
  groundingChunks: z.array(z.object({ uri: z.string(), title: z.string() })),
  groundingSupports: z.array(z.object({ text: z.string(), chunkIndices: z.array(z.number().int().nonnegative()) })),
});
export type Grounded = z.infer<typeof grounding>;
export async function groundedSearch(prompt: AiPrompt): Promise<Grounded> {
  const text = typeof prompt === "string" ? prompt : prompt.text;
  let raw: unknown;
  if (process.env.AI_STUB_DIR) {
    try { raw = JSON.parse(await fixture(process.env.AI_STUB_DIR, typeof prompt === "string" ? undefined : prompt.stubKey)); }
    catch (error) { if (error instanceof AiError) throw error; throw new AiError("INVALID_OUTPUT"); }
  } else {
    const keys = geminiKeys(), model = process.env.GEMINI_MODEL?.trim();
    if (!keys.length || !model) throw new AiError("NOT_CONFIGURED");
    for (const [i, key] of keys.entries()) {
      try {
        const client = new GoogleGenAI({ apiKey: key, vertexai: false, httpOptions: { timeout: 30000, retryOptions: { attempts: 1 } } });
        const response = await client.models.generateContent({ model, contents: text, config: { tools: [{ googleSearch: {} }] } });
        const metadata = response.candidates?.[0]?.groundingMetadata;
        raw = { text: response.text, model,
          groundingChunks: (metadata?.groundingChunks ?? []).map((c) => ({ uri: c.web?.uri ?? "", title: c.web?.title ?? "" })),
          groundingSupports: (metadata?.groundingSupports ?? []).map((s) => ({ text: s.segment?.text ?? "", chunkIndices: s.groundingChunkIndices ?? [] })) };
        break;
      } catch { if (i === keys.length - 1) throw new AiError("PROVIDER_ERROR"); } // spent credits: try the spare key
    }
  }
  const result = grounding.safeParse(raw);
  if (!result.success) throw new AiError("INVALID_OUTPUT");
  const data = result.data;
  data.groundingSupports = data.groundingSupports.filter((s) => s.text.trim() && data.text.includes(s.text)).map((s) => ({ ...s,
    chunkIndices: s.chunkIndices.filter((i) => { try { return ["https:", "http:"].includes(new URL(data.groundingChunks[i]?.uri).protocol); } catch { return false; } })
  })).filter((s) => s.chunkIndices.length);
  if (!data.groundingSupports.length) throw new AiError("INVALID_OUTPUT");
  return data;
}
