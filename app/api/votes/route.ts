import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/workspace/require";
import { respond, sameOrigin } from "@/lib/workspace/http";
import { boundary, readBody } from "@/lib/ideas/http";
import { IdeaError } from "@/lib/ideas/contract";
import { castVote, readVotes, voteSchema } from "@/lib/votes/service";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  return boundary(async () => respond(await readVotes(await requireWorkspace(request))));
}
export async function PUT(request: NextRequest) {
  return boundary(async () => {
    sameOrigin(request);
    const identity = await requireWorkspace(request);
    const parsed = voteSchema.safeParse(await readBody(request));
    if (!parsed.success) throw new IdeaError(400, "Provide a versionId and a concern (text up to 1000 characters, or null)");
    return respond(await castVote(identity, parsed.data.versionId, parsed.data.concern));
  });
}
