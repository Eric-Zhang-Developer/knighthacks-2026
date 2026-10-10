import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/workspace/require";
import { respond } from "@/lib/workspace/http";
import { boundary } from "@/lib/ideas/http";
import { IdeaError } from "@/lib/ideas/contract";
import { uuid } from "@/lib/revisions/contract";
import { trail } from "@/lib/revisions/service";
export const runtime = "nodejs";
export async function GET(request: NextRequest, { params }: { params: Promise<{ ideaId: string }> }) {
  return boundary(async () => {
    const identity = await requireWorkspace(request);
    const id = uuid.safeParse((await params).ideaId);
    if (!id.success) throw new IdeaError(404, "Idea not found");
    return respond(await trail(identity.workspaceId, id.data));
  });
}
