import { z } from "zod";
import type { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/workspace/require";
import { respond, sameOrigin } from "@/lib/workspace/http";
import { WorkspaceError } from "@/lib/workspace/tokens";
import { readBody } from "@/lib/ideas/http";
import { IdeaError } from "@/lib/ideas/contract";
import { ExperimentError, patchSchema, startSchema } from "./contract";
import * as service from "./service";

// Same session and same-origin rules as challenge (lib/challenge/http.ts).
async function boundary(action: () => Promise<ReturnType<typeof respond>>) {
  try { return await action(); }
  catch (error) {
    if (error instanceof ExperimentError || error instanceof WorkspaceError || error instanceof IdeaError) return respond({ error: error.message }, error.status);
    return respond({ error: "Experiments are temporarily unavailable. Please retry." }, 503);
  }
}

export function startRoute(request: NextRequest) {
  return boundary(async () => {
    sameOrigin(request);
    const identity = await requireWorkspace(request);
    const body = startSchema.safeParse(await readBody(request));
    if (!body.success) throw new ExperimentError(400, "Provide a challenge sessionId and round (1-3)");
    const { status, experiment } = await service.start(identity.workspaceId, body.data.sessionId, body.data.round);
    return respond(experiment, status);
  });
}

export function listRoute(request: NextRequest) {
  return boundary(async () => {
    const identity = await requireWorkspace(request);
    const versionId = z.uuid().safeParse(request.nextUrl.searchParams.get("versionId"));
    if (!versionId.success) throw new ExperimentError(400, "Provide a versionId");
    return respond(await service.list(identity.workspaceId, versionId.data));
  });
}

export function patchRoute(request: NextRequest, id: Promise<string>) {
  return boundary(async () => {
    sameOrigin(request);
    const identity = await requireWorkspace(request), experimentId = await id;
    if (!z.uuid().safeParse(experimentId).success) throw new ExperimentError(400, "Invalid experiment ID");
    const body = patchSchema.safeParse(await readBody(request));
    if (!body.success) throw new ExperimentError(400, "Edit hypothesis, procedure or observable, or record a result: confirmed, refuted or inconclusive");
    return respond(await service.update(identity.workspaceId, experimentId, body.data));
  });
}
