import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/workspace/require";
import { respond, sameOrigin } from "@/lib/workspace/http";
import { boundary, readBody } from "@/lib/ideas/http";
import { IdeaError } from "@/lib/ideas/contract";
import { suggestSchema } from "@/lib/branches/contract";
import { suggest } from "@/lib/branches/service";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  return boundary(async () => {
    sameOrigin(request);
    const identity = await requireWorkspace(request);
    const parsed = suggestSchema.safeParse(await readBody(request));
    if (!parsed.success) throw new IdeaError(400, "Provide a versionId");
    return respond(await suggest(identity.workspaceId, parsed.data.versionId));
  });
}
