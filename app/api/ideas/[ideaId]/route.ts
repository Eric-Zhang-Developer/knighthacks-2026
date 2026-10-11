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
    return respond(await deleteIdea(identity.workspaceId, parsed.data));
  });
}
