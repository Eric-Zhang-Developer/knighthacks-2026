import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/workspace/require";
import { respond, sameOrigin } from "@/lib/workspace/http";
import { boundary } from "@/lib/ideas/http";
import { IdeaError } from "@/lib/ideas/contract";
import { accept } from "@/lib/branches/service";
export const runtime = "nodejs";
export async function POST(request: NextRequest, { params }: { params: Promise<{ directionId: string }> }) {
  return boundary(async () => {
    sameOrigin(request);
    const identity = await requireWorkspace(request);
    const id = z.uuid().safeParse((await params).directionId);
    if (!id.success) throw new IdeaError(404, "Direction not found");
    const result = await accept(identity.workspaceId, id.data);
    return respond(result.version, result.created ? 201 : 200);
  });
}
