import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/workspace/require";
import { respond, sameOrigin } from "@/lib/workspace/http";
import { boundary, readBody } from "@/lib/ideas/http";
import { IdeaError } from "@/lib/ideas/contract";
import { proposeSchema } from "@/lib/revisions/contract";
import { propose } from "@/lib/revisions/service";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  return boundary(async () => {
    sameOrigin(request);
    const identity = await requireWorkspace(request);
    const parsed = proposeSchema.safeParse(await readBody(request));
    if (!parsed.success) throw new IdeaError(400, "Provide a versionId and optional context up to 4000 characters");
    return respond(await propose(identity.workspaceId, parsed.data.versionId, parsed.data.context));
  });
}
