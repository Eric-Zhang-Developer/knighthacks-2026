import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/workspace/require";
import { respond, sameOrigin } from "@/lib/workspace/http";
import { WorkspaceError } from "@/lib/workspace/tokens";
import { AlternativeError } from "@/lib/alternative/contract";
import { createAlternative, getAlternative } from "@/lib/alternative/service";
export const runtime = "nodejs";
type Context = { params: Promise<{ versionId: string }> };
async function handle(request: NextRequest, context: Context, write: boolean) {
  try {
    if (write) sameOrigin(request);
    const identity = await requireWorkspace(request), { versionId } = await context.params;
    if (!z.uuid().safeParse(versionId).success) throw new AlternativeError(400, "Invalid idea version ID");
    if (write && request.body) {
      const reader = request.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value.byteLength) { await reader.cancel(); throw new AlternativeError(400, "Comparison requests accept no body"); }
        }
      } finally { reader.releaseLock(); }
    }
    return respond(write ? await createAlternative(identity.workspaceId, versionId) : await getAlternative(identity.workspaceId, versionId));
  } catch (error) {
    if (error instanceof AlternativeError || error instanceof WorkspaceError) return respond({ error: error.message }, error.status);
    return respond({ error: "Alternatives are temporarily unavailable. Please retry." }, 503);
  }
}
export async function POST(request: NextRequest, context: Context) { return handle(request, context, true); }
export async function GET(request: NextRequest, context: Context) { return handle(request, context, false); }
