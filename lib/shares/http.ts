import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { respond, sameOrigin } from "@/lib/workspace/http";
import { requireWorkspace } from "@/lib/workspace/require";
import { WorkspaceError } from "@/lib/workspace/tokens";
import { readBody } from "@/lib/ideas/http";
import { IdeaError } from "@/lib/ideas/contract";
import { ShareError } from "./tokens";
import { createShare, readShare, revokeShare } from "./service";
const createSchema = z.object({ snapshotId: z.uuid() }).strict();
async function boundary(action: () => Promise<NextResponse>) {
  try { return await action(); }
  catch (error) {
    if (error instanceof ShareError || error instanceof WorkspaceError || error instanceof IdeaError) return respond({ error: error.message }, error.status);
    return respond({ error: "Shares are temporarily unavailable. Please retry." }, 503);
  }
}
export async function createRoute(request: NextRequest) {
  return boundary(async () => {
    sameOrigin(request);
    const identity = await requireWorkspace(request);
    const body = createSchema.safeParse(await readBody(request));
    if (!body.success) throw new ShareError(400, "Provide only a valid snapshotId");
    const token = await createShare(identity.workspaceId, body.data.snapshotId);
    return respond({ token, url: new URL(`/s/${token}`, new URL(request.url).origin).href }, 201);
  });
}
export async function readRoute(_request: NextRequest, token: Promise<string>) {
  // Public capability read: deliberately no session lookup or creation.
  return boundary(async () => respond(await readShare(await token)));
}
export async function revokeRoute(request: NextRequest, token: Promise<string>) {
  return boundary(async () => {
    sameOrigin(request);
    const identity = await requireWorkspace(request);
    await revokeShare(identity.workspaceId, await token);
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  });
}
