import type { NextRequest } from "next/server";
import { z } from "zod";
import { respond, sameOrigin } from "@/lib/workspace/http";
import { requireWorkspace } from "@/lib/workspace/require";
import { WorkspaceError } from "@/lib/workspace/tokens";
import { readBody } from "@/lib/ideas/http";
import { IdeaError } from "@/lib/ideas/contract";
import { proofSchema, RubricError } from "./contract";
import { createOverlay, getOverlay, patchProof } from "./service";
async function boundary(action: () => Promise<ReturnType<typeof respond>>) {
  try { return await action(); }
  catch (error) {
    if (error instanceof RubricError || error instanceof WorkspaceError || error instanceof IdeaError) return respond({ error: error.message }, error.status);
    return respond({ error: "Rubric service is temporarily unavailable. Please retry." }, 503);
  }
}
async function identifier(id: Promise<string>) {
  const value = await id;
  if (!z.uuid().safeParse(value).success) throw new RubricError(400, "Invalid version ID");
  return value.toLowerCase();
}
async function emptyBody(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader) return;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) return;
      if (chunk.value.byteLength) { void reader.cancel().catch(() => {}); throw new RubricError(400, "POST does not accept a body"); }
    }
  } finally { reader.releaseLock(); }
}
export function readRoute(request: NextRequest, id: Promise<string>) {
  return boundary(async () => {
    const identity = await requireWorkspace(request);
    return respond(await getOverlay(identity.workspaceId, await identifier(id)));
  });
}
export function createRoute(request: NextRequest, id: Promise<string>) {
  return boundary(async () => {
    sameOrigin(request);
    const identity = await requireWorkspace(request), versionId = await identifier(id);
    await emptyBody(request);
    return respond(await createOverlay(identity.workspaceId, versionId));
  });
}
export function proofRoute(request: NextRequest, params: Promise<{ versionId: string; trackId: string }>) {
  return boundary(async () => {
    sameOrigin(request);
    const identity = await requireWorkspace(request), values = await params, versionId = await identifier(Promise.resolve(values.versionId));
    const parsed = proofSchema.safeParse(await readBody(request));
    if (!parsed.success) throw new RubricError(400, "Provide only proof: a nonblank note or link up to 4000 characters, or null");
    return respond(await patchProof(identity.workspaceId, versionId, values.trackId, parsed.data.proof));
  });
}
