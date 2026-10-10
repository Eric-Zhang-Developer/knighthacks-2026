import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/workspace/require";
import { sameOrigin, respond } from "@/lib/workspace/http";
import { WorkspaceError } from "@/lib/workspace/tokens";
import { EvidenceError } from "@/lib/evidence/contract";
import { createEvidence, getEvidence } from "@/lib/evidence/service";
export const runtime = "nodejs";
type Context = { params: Promise<{ versionId: string }> };
async function handle(request: NextRequest, context: Context, write: boolean) {
  try {
    if (write) sameOrigin(request);
    const identity = await requireWorkspace(request);
    const { versionId } = await context.params;
    if (!z.string().uuid().safeParse(versionId).success) throw new EvidenceError(400, "Invalid idea version ID");
    const query = request.nextUrl.searchParams;
    if ([...query.keys()].some((key) => key !== "all") || query.getAll("all").length > 1 ||
      (query.has("all") && query.get("all") !== "true")) throw new EvidenceError(400, "Use all=true to request remaining neighbors");
    if (write && request.body) {
      const reader = request.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value.byteLength) {
            await reader.cancel();
            throw new EvidenceError(400, "This endpoint accepts no request body");
          }
        }
      } finally { reader.releaseLock(); }
    }
    return respond(write ? await createEvidence(identity.workspaceId, versionId, query.get("all") === "true") : await getEvidence(identity.workspaceId, versionId));
  } catch (error) {
    if (error instanceof EvidenceError || error instanceof WorkspaceError) return respond({ error: error.message }, error.status);
    return respond({ error: "Evidence is temporarily unavailable. Please try again." }, 503);
  }
}
export async function GET(request: NextRequest, context: Context) { return handle(request, context, false); }
export async function POST(request: NextRequest, context: Context) { return handle(request, context, true); }
