import type { NextRequest, NextResponse } from "next/server";
import { respond } from "@/lib/workspace/http";
import { WorkspaceError } from "@/lib/workspace/tokens";
import { MentorError } from "./contract";

/** Count bytes while streaming, before JSON parsing or retaining an unbounded body. */
export async function readJson(request: NextRequest): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    throw new MentorError(400, "JSON body required");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new MentorError(400, "JSON body required");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16 * 1024) {
        await reader.cancel();
        throw new MentorError(413, "Request too large");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof MentorError) throw error;
    throw new MentorError(400, "Invalid JSON body");
  } finally { reader.releaseLock(); }
}

export async function boundary(action: () => Promise<NextResponse>) {
  try { return await action(); }
  catch (error) {
    if (error instanceof MentorError || error instanceof WorkspaceError) return respond({ error: error.message }, error.status);
    return respond({ error: "The spoken mentor is temporarily unavailable" }, 503);
  }
}
