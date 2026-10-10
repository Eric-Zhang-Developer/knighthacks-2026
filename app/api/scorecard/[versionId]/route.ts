import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/workspace/require";
import { respond, sameOrigin } from "@/lib/workspace/http";
import { WorkspaceError } from "@/lib/workspace/tokens";
import { EvidenceError } from "@/lib/evidence/contract";
import { ScorecardError } from "@/lib/scorecard/contract";
import { createScorecard, getScorecard } from "@/lib/scorecard/service";
export const runtime = "nodejs";
type Context = { params: Promise<{ versionId: string }> };
async function handle(request: NextRequest, context: Context, write: boolean) {
  try {
    if (write) sameOrigin(request);
    const identity = await requireWorkspace(request);
    const { versionId } = await context.params;
    if (!z.uuid().safeParse(versionId).success) throw new ScorecardError(404, "Idea version not found");
    return respond(write ? await createScorecard(identity.workspaceId, versionId) : await getScorecard(identity.workspaceId, versionId));
  } catch (error) {
    if (error instanceof ScorecardError || error instanceof EvidenceError || error instanceof WorkspaceError) return respond({ error: error.message }, error.status);
    return respond({ error: "The scorecard is temporarily unavailable. Please try again." }, 503);
  }
}
export async function POST(request: NextRequest, context: Context) { return handle(request, context, true); }
export async function GET(request: NextRequest, context: Context) { return handle(request, context, false); }
