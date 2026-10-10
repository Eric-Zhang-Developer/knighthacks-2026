import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/workspace/require";
import { sameOrigin, respond } from "@/lib/workspace/http";
import { WorkspaceError } from "@/lib/workspace/tokens";
import { CombinationError } from "@/lib/combinations/contract";
import { createCombinations, getCombinations } from "@/lib/combinations/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ versionId: string }> };
async function handle(request: NextRequest, context: Context, create: boolean) {
  try {
    if (create) sameOrigin(request);
    const identity = await requireWorkspace(request), { versionId } = await context.params;
    if (!z.uuid().safeParse(versionId).success) throw new CombinationError(400, "Invalid version ID");
    if (create && request.body) {
      const reader = request.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value.byteLength) { void reader.cancel().catch(() => {}); throw new CombinationError(400, "POST does not accept a body"); }
        }
      } finally { reader.releaseLock(); }
    }
    return respond(await (create ? createCombinations : getCombinations)(identity.workspaceId, versionId.toLowerCase()));
  } catch (error) {
    if (error instanceof WorkspaceError || error instanceof CombinationError) return respond({ error: error.message }, error.status);
    return respond({ error: "Combinations are temporarily unavailable. Please retry." }, 503);
  }
}
export const POST = (request: NextRequest, context: Context) => handle(request, context, true);
export const GET = (request: NextRequest, context: Context) => handle(request, context, false);
