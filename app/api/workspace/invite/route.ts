import type { NextRequest } from "next/server";
import { boundary, body, respond, sameOrigin } from "@/lib/workspace/http";
import { requireWorkspace } from "@/lib/workspace/require";
import { createInvite } from "@/lib/workspace/service";
import { WorkspaceError } from "@/lib/workspace/tokens";
export const runtime = "nodejs";
export function POST(request: NextRequest) {
  return boundary(async () => {
    sameOrigin(request);
    const input = await body(request);
    if (input.workspaceId !== undefined && typeof input.workspaceId !== "string") throw new WorkspaceError(400, "Invalid workspace ID");
    const identity = await requireWorkspace(request, input.workspaceId as string | undefined);
    const invite = await createInvite(identity);
    return respond({ inviteUrl: new URL(`/invite/${invite.token}`, request.url).href, expiresAt: invite.expiresAt }, 201);
  });
}
