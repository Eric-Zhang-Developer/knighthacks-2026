import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/workspace/require";
import { respond, sameOrigin } from "@/lib/workspace/http";
import { WorkspaceError } from "@/lib/workspace/tokens";
import { readBody } from "@/lib/ideas/http";
import { IdeaError } from "@/lib/ideas/contract";
import { startSchema, answerSchema, ChallengeError } from "./contract";
import * as service from "./service";
async function boundary(action: () => Promise<ReturnType<typeof respond>>) {
  try { return await action(); }
  catch (error) {
    if (error instanceof ChallengeError || error instanceof WorkspaceError || error instanceof IdeaError) return respond({ error: error.message }, error.status);
    return respond({ error: "Challenge service is temporarily unavailable. Please retry." }, 503);
  }
}
async function emptyBody(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader) return;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      if (value.byteLength) { await reader.cancel(); throw new ChallengeError(400, "Round requests accept no body"); }
    }
  } finally { reader.releaseLock(); }
}
export async function startRoute(request: NextRequest) {
  return boundary(async () => {
    sameOrigin(request);
    const identity = await requireWorkspace(request);
    const body = startSchema.safeParse(await readBody(request));
    if (!body.success) throw new ChallengeError(400, "Provide a versionId and user, judge, or engineer perspective");
    return respond(await service.start(identity.workspaceId, body.data.versionId, body.data.perspective), 201);
  });
}
export async function sessionRoute(request: NextRequest, id: Promise<string>, operation: "round" | "answer") {
  return boundary(async () => {
    sameOrigin(request);
    const identity = await requireWorkspace(request), sessionId = await id;
    if (!z.uuid().safeParse(sessionId).success) throw new ChallengeError(400, "Invalid challenge session ID");
    if (operation === "round") { await emptyBody(request); return respond(await service.round(identity.workspaceId, sessionId)); }
    const body = answerSchema.safeParse(await readBody(request));
    if (!body.success) throw new ChallengeError(400, "Provide a nonblank answer up to 8000 characters");
    return respond(await service.answer(identity.workspaceId, sessionId, body.data.answer));
  });
}
