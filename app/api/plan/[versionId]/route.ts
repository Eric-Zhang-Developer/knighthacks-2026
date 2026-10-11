import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/workspace/require";
import { respond, sameOrigin } from "@/lib/workspace/http";
import { WorkspaceError } from "@/lib/workspace/tokens";
import { inputSchema, PlanError } from "@/lib/plan/contract";
import { createPlan, getPlan } from "@/lib/plan/service";
export const runtime = "nodejs";
type Context = { params: Promise<{ versionId: string }> };
async function handle(request: NextRequest, context: Context, write: boolean) {
  try {
    if (write) sameOrigin(request);
    const identity = await requireWorkspace(request);
    const { versionId } = await context.params;
    if (!z.uuid().safeParse(versionId).success) throw new PlanError(404, "Idea version not found");
    if (!write) return respond(await getPlan(identity.workspaceId, versionId));
    const body = inputSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) throw new PlanError(400, "Send hoursLeft (2–72), teamSize (1–20, default 2), and optional skills (up to 12 short strings).");
    return respond(await createPlan(identity.workspaceId, versionId, body.data), 201);
  } catch (error) {
    if (error instanceof PlanError || error instanceof WorkspaceError) return respond({ error: error.message }, error.status);
    return respond({ error: "Build planning is temporarily unavailable. Please try again." }, 503);
  }
}
export async function POST(request: NextRequest, context: Context) { return handle(request, context, true); }
export async function GET(request: NextRequest, context: Context) { return handle(request, context, false); }
