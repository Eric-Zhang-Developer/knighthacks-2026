import type { NextRequest } from "next/server";
import { respond } from "@/lib/workspace/http";
import { WorkspaceError } from "@/lib/workspace/tokens";
import { IdeaError } from "./contract";

export async function readBody(request: NextRequest): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new IdeaError(400, "JSON body required");
  const reader = request.body?.getReader();
  if (!reader) throw new IdeaError(400, "JSON body required");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) { await reader.cancel(); throw new IdeaError(413, "Request too large"); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof IdeaError) throw error;
    throw new IdeaError(400, "Invalid JSON body");
  } finally { reader.releaseLock(); }
}
export async function boundary(action: () => Promise<ReturnType<typeof respond>>) {
  try { return await action(); }
  catch (error) {
    if (error instanceof IdeaError || error instanceof WorkspaceError) return respond({ error: error.message }, error.status);
    return respond({ error: "Ideas are temporarily unavailable. Please try again." }, 503);
  }
}
