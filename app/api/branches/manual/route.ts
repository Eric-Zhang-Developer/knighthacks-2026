import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/workspace/require";
import { respond, sameOrigin } from "@/lib/workspace/http";
import { boundary, readBody } from "@/lib/ideas/http";
import { IdeaError } from "@/lib/ideas/contract";
import { manualSchema } from "@/lib/branches/contract";
import { manual } from "@/lib/branches/service";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  return boundary(async () => {
    sameOrigin(request);
    const identity = await requireWorkspace(request);
    const parsed = manualSchema.safeParse(await readBody(request));
    if (!parsed.success) throw new IdeaError(400, "Provide a versionId and fields to edit");
    return respond(await manual(identity.workspaceId, parsed.data.versionId, parsed.data.fields), 201);
  });
}
