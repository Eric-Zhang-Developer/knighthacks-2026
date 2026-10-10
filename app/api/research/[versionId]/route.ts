import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/workspace/require";
import { respond, sameOrigin } from "@/lib/workspace/http";
import { WorkspaceError } from "@/lib/workspace/tokens";
import { ResearchError } from "@/lib/research/contract";
import { createResearch, getResearch } from "@/lib/research/service";
export const runtime = "nodejs";
type Context = { params: Promise<{ versionId: string }> };
async function handle(request: NextRequest, context: Context, write: boolean) {
  try {
    if (write) sameOrigin(request);
    const identity = await requireWorkspace(request);
    const { versionId } = await context.params;
    if (!z.uuid().safeParse(versionId).success) throw new ResearchError(404, "Idea version not found");
    return respond(write ? await createResearch(identity.workspaceId, versionId) : await getResearch(identity.workspaceId, versionId));
  } catch (error) {
    if (error instanceof ResearchError || error instanceof WorkspaceError) return respond({ error: error.message }, error.status);
    return respond({ error: "Research is temporarily unavailable. Please try again." }, 503);
  }
}
export async function POST(request: NextRequest, context: Context) { return handle(request, context, true); }
export async function GET(request: NextRequest, context: Context) { return handle(request, context, false); }
