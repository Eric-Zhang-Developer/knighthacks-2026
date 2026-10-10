import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/workspace/require";
import { respond, sameOrigin } from "@/lib/workspace/http";
import { boundary, readBody } from "@/lib/ideas/http";
import { IdeaError, saveSchema } from "@/lib/ideas/contract";
import { createIdea, listIdeas } from "@/lib/ideas/service";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  return boundary(async () => {
    const identity = await requireWorkspace(request);
    return respond(await listIdeas(identity.workspaceId));
  });
}
export async function POST(request: NextRequest) {
  return boundary(async () => {
    sameOrigin(request);
    const identity = await requireWorkspace(request);
    const key = request.headers.get("idempotency-key");
    if (!key || !/^[a-zA-Z0-9._:-]{1,128}$/.test(key)) throw new IdeaError(400, "A valid Idempotency-Key header is required");
    const parsed = saveSchema.safeParse(await readBody(request));
    if (!parsed.success) throw new IdeaError(400, "Provide the six nullable idea fields and at least one nonblank value");
    const result = await createIdea(identity.workspaceId, key, parsed.data);
    return respond(result.version, result.created ? 201 : 200);
  });
}
