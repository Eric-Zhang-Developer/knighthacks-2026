import type { NextRequest } from "next/server";
import { boundary, body, respond, sameOrigin } from "@/lib/workspace/http";
import { session } from "@/lib/workspace/require";
import { redeemInvite } from "@/lib/workspace/service";
import { validToken, WorkspaceError } from "@/lib/workspace/tokens";
export const runtime = "nodejs";
export function POST(request: NextRequest) {
  return boundary(async () => {
    sameOrigin(request);
    const input = await body(request);
    if (!validToken(input.token)) throw new WorkspaceError(410, "Invite unavailable, expired, or already used");
    const redeemed = await redeemInvite(input.token, await session(request));
    return respond(redeemed.identity, 201, redeemed.token);
  });
}
