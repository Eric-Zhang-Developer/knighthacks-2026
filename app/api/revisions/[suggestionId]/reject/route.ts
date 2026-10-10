import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/workspace/require";
import { respond, sameOrigin } from "@/lib/workspace/http";
import { boundary } from "@/lib/ideas/http";
import { IdeaError } from "@/lib/ideas/contract";
import { uuid } from "@/lib/revisions/contract";
import { reject } from "@/lib/revisions/service";
export const runtime = "nodejs";
export async function POST(request: NextRequest, { params }: { params: Promise<{ suggestionId: string }> }) {
  return boundary(async () => {
    sameOrigin(request);
    const identity = await requireWorkspace(request);
    const id = uuid.safeParse((await params).suggestionId);
    if (!id.success) throw new IdeaError(404, "Suggestion not found");
    await reject(identity.workspaceId, id.data);
    return respond({ rejected: true });
  });
}
