import type { NextRequest } from "next/server";
import { z } from "zod";
import { respond, sameOrigin } from "@/lib/workspace/http";
import { requireWorkspace } from "@/lib/workspace/require";
import { WorkspaceError } from "@/lib/workspace/tokens";
import { readBody } from "@/lib/ideas/http";
import { IdeaError } from "@/lib/ideas/contract";
import { assessInput, ChallengeError, confirmInput } from "./contract";
import { importDraft, readMultipart } from "./extract";
import { assess, confirm, createDraft, deleteChallenge, getAssessment, getChallenge, listChallenges } from "./service";

async function boundary(action: () => Promise<ReturnType<typeof respond>>) {
  try { return await action(); }
  catch (error) {
    if (error instanceof ChallengeError || error instanceof WorkspaceError || error instanceof IdeaError) return respond({ error: error.message }, error.status);
    return respond({ error: "Sponsor challenge service is temporarily unavailable. Please retry." }, 503);
  }
}
const uuid = (value: string, what: string) => {
  if (!z.uuid().safeParse(value).success) throw new ChallengeError(400, `Invalid ${what}`);
  return value.toLowerCase();
};
type Params = Promise<Record<string, string>>;

export const importRoute = (request: NextRequest) => boundary(async () => {
  sameOrigin(request);
  const identity = await requireWorkspace(request);
  return respond(await createDraft(identity.workspaceId, await importDraft(await readMultipart(request))), 201);
});
export const listRoute = (request: NextRequest) => boundary(async () => {
  const identity = await requireWorkspace(request);
  return respond({ challenges: await listChallenges(identity.workspaceId) });
});
export const readRoute = (request: NextRequest, params: Params) => boundary(async () => {
  const identity = await requireWorkspace(request);
  return respond(await getChallenge(identity.workspaceId, uuid((await params).id, "challenge ID")));
});
export const deleteRoute = (request: NextRequest, params: Params) => boundary(async () => {
  sameOrigin(request);
  const identity = await requireWorkspace(request);
  await deleteChallenge(identity.workspaceId, uuid((await params).id, "challenge ID"));
  return respond({ deleted: true });
});
export const confirmRoute = (request: NextRequest, params: Params) => boundary(async () => {
  sameOrigin(request);
  const identity = await requireWorkspace(request), id = uuid((await params).id, "challenge ID");
  const parsed = confirmInput.safeParse(await readBody(request));
  if (!parsed.success) throw new ChallengeError(400, "Provide transcript, requirements (kind, exact quote, summary) and rubric or null");
  return respond(await confirm(identity.workspaceId, id, parsed.data), 201);
});
export const assessRoute = (request: NextRequest, params: Params) => boundary(async () => {
  sameOrigin(request);
  const identity = await requireWorkspace(request), id = uuid((await params).id, "challenge ID");
  const key = request.headers.get("idempotency-key");
  if (!key || !/^[a-zA-Z0-9._:-]{1,128}$/.test(key)) throw new ChallengeError(400, "A valid Idempotency-Key header is required");
  const parsed = assessInput.safeParse(await readBody(request));
  if (!parsed.success) throw new ChallengeError(400, "Provide revisionId, versionId and optional evidence (at most 16,000 characters in all)");
  const result = await assess(identity.workspaceId, id, key, parsed.data);
  return respond(result.body, result.status);
});
export const assessmentRoute = (request: NextRequest, params: Params) => boundary(async () => {
  const identity = await requireWorkspace(request), values = await params;
  return respond(await getAssessment(identity.workspaceId, uuid(values.id, "challenge ID"), uuid(values.assessmentId, "assessment ID")));
});
