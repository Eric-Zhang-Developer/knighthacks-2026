import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/workspace/require";
import { respond, sameOrigin } from "@/lib/workspace/http";
import { WorkspaceError } from "@/lib/workspace/tokens";
import { bodySchema, RehearsalError } from "@/lib/rehearsal/contract";
import { createRehearsal, getRehearsal } from "@/lib/rehearsal/service";
export const runtime = "nodejs";
type Context = { params: Promise<{ versionId: string }> };
async function handle(request: NextRequest, context: Context, write: boolean) {
  try {
    if (write) sameOrigin(request);
    const identity = await requireWorkspace(request);
    const { versionId } = await context.params;
    if (!z.uuid().safeParse(versionId).success) throw new RehearsalError(404, "Idea version not found");
    if (!write) return respond(await getRehearsal(identity.workspaceId, versionId));
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) throw new RehearsalError(400, "Send `built`: 1 to 8 items, each at most 120 characters.");
    return respond(await createRehearsal(identity.workspaceId, versionId, body.data.built));
  } catch (error) {
    if (error instanceof RehearsalError || error instanceof WorkspaceError) return respond({ error: error.message }, error.status);
    return respond({ error: "The rehearsal is temporarily unavailable. Please try again." }, 503);
  }
}
export async function POST(request: NextRequest, context: Context) { return handle(request, context, true); }
export async function GET(request: NextRequest, context: Context) { return handle(request, context, false); }
