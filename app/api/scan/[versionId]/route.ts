import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/workspace/require";
import { respond } from "@/lib/workspace/http";
import { WorkspaceError } from "@/lib/workspace/tokens";
import { ScanError, scanOf } from "@/lib/scan/service";
export const runtime = "nodejs";
type Context = { params: Promise<{ versionId: string }> };

// GET: an idea version's stored neighbours with their cosine similarity (specs/features/idea-scan, Plan 1).
export async function GET(request: NextRequest, context: Context) {
  try {
    const identity = await requireWorkspace(request);
    const { versionId } = await context.params;
    if (!z.string().uuid().safeParse(versionId).success) throw new ScanError(404, "Idea version not found");
    return respond(await scanOf(identity.workspaceId, versionId));
  } catch (error) {
    if (error instanceof ScanError || error instanceof WorkspaceError) return respond({ error: error.message }, error.status);
    return respond({ error: "The scan is temporarily unavailable." }, 503);
  }
}
