import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/workspace/require";
import { respond, sameOrigin } from "@/lib/workspace/http";
import { boundary, readBody } from "@/lib/ideas/http";
import { IdeaError } from "@/lib/ideas/contract";
import { requestSchema } from "@/lib/compare/contract";
import { compare } from "@/lib/compare/service";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  return boundary(async () => {
    sameOrigin(request);
    const identity = await requireWorkspace(request);
    const parsed = requestSchema.safeParse(await readBody(request));
    if (!parsed.success) throw new IdeaError(400, "Choose two or three distinct versionIds");
    return respond(await compare(identity.workspaceId, parsed.data.versionIds));
  });
}
