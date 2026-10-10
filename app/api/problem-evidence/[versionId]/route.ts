import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/workspace/require";
import { respond, sameOrigin } from "@/lib/workspace/http";
import { WorkspaceError } from "@/lib/workspace/tokens";
import { EvidenceError } from "@/lib/problem-evidence/contract";
import { createEvidence, getEvidence } from "@/lib/problem-evidence/service";
export const runtime = "nodejs";
type Context = { params: Promise<{ versionId: string }> };
async function handle(request: NextRequest, context: Context, write: boolean) {
  try {
    if (write) sameOrigin(request);
    const identity = await requireWorkspace(request);
    const { versionId } = await context.params;
    if (!z.uuid().safeParse(versionId).success) throw new EvidenceError(404, "Idea version not found");
    return respond(write ? await createEvidence(identity.workspaceId, versionId) : await getEvidence(identity.workspaceId, versionId));
  } catch (error) {
    if (error instanceof EvidenceError || error instanceof WorkspaceError) return respond({ error: error.message }, error.status);
    return respond({ error: "Problem evidence is temporarily unavailable. Please try again." }, 503);
  }
}
export async function POST(request: NextRequest, context: Context) { return handle(request, context, true); }
export async function GET(request: NextRequest, context: Context) { return handle(request, context, false); }
