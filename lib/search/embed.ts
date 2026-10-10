import "next/dist/compiled/server-only";
import { InferenceClient } from "@huggingface/inference";

// The same endpoint and model corpus/embed uses (specs/decisions/corpus-embed-vectors.md), normalized like the corpus.
export async function embed(text: string): Promise<number[]> {
  const token = process.env.HF_TOKEN;
  const model = process.env.EMBED_MODEL;
  if (!token || !model) throw new Error("HF_TOKEN or EMBED_MODEL is not set");
  const out = await new InferenceClient(token).featureExtraction({ model, inputs: text, provider: "hf-inference" });
  const v = (Array.isArray(out[0]) ? out[0] : out) as number[];
  if (!v.length || v.some((x) => typeof x !== "number")) throw new Error("unexpected embedding shape");
  const norm = Math.hypot(...v);
  return v.map((x) => x / norm);
}
