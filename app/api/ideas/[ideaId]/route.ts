import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/workspace/require";
import { respond, sameOrigin } from "@/lib/workspace/http";
import { boundary } from "@/lib/ideas/http";
import { IdeaError } from "@/lib/ideas/contract";
import { deleteIdea } from "@/lib/ideas/service";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest, context: { params: Promise<{ ideaId: string }> }) {
  return boundary(async () => {
    sameOrigin(request);
    const identity = await requireWorkspace(request);
    const parsed = z.uuid().safeParse((await context.params).ideaId);
    if (!parsed.success) throw new IdeaError(404, "Idea not found");
    // Preview deployments may use production data. Keep this rollout confined to
    // the explicitly configured test database until production approval/verification.
    const testDatabase = process.env.TEST_DATABASE_URL;
    if (!testDatabase?.trim() || process.env.DATABASE_URL !== testDatabase) {
      throw new IdeaError(503, "Idea deletion is not enabled in this environment");
    }
    return respond(await deleteIdea(identity.workspaceId, parsed.data));
  });
}
