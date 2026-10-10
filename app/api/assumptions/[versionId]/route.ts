import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/workspace/require";
import { respond, sameOrigin } from "@/lib/workspace/http";
import { WorkspaceError } from "@/lib/workspace/tokens";
import { AssumptionsError } from "@/lib/assumptions/contract";
import { createAssumptions, getAssumptions } from "@/lib/assumptions/service";
export const runtime = "nodejs";
type Context = { params: Promise<{ versionId: string }> };
// Same session, same-origin and 404 rules as the other idea routes (app/api/alternative/).
async function handle(request: NextRequest, context: Context, write: boolean) {
  try {
    if (write) sameOrigin(request);
    const identity = await requireWorkspace(request), { versionId } = await context.params;
    if (!z.uuid().safeParse(versionId).success) throw new AssumptionsError(400, "Invalid idea version ID");
    if (write && request.body) {
      const reader = request.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value.byteLength) { await reader.cancel(); throw new AssumptionsError(400, "Assumption requests accept no body"); }
        }
      } finally { reader.releaseLock(); }
    }
    return respond(write ? await createAssumptions(identity.workspaceId, versionId) : await getAssumptions(identity.workspaceId, versionId));
  } catch (error) {
    if (error instanceof AssumptionsError || error instanceof WorkspaceError) return respond({ error: error.message }, error.status);
    return respond({ error: "Assumptions are temporarily unavailable. Please retry." }, 503);
  }
}
export async function POST(request: NextRequest, context: Context) { return handle(request, context, true); }
export async function GET(request: NextRequest, context: Context) { return handle(request, context, false); }
