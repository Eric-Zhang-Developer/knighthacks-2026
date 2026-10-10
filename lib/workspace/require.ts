import type { NextRequest } from "next/server";
import { lookupSession, type Identity } from "./service";
import { COOKIE, validToken, WorkspaceError } from "./tokens";
export async function session(request: NextRequest): Promise<Identity | null> {
  const token = request.cookies.get(COOKIE)?.value;
  return validToken(token) ? lookupSession(token) : null;
}
export async function requireWorkspace(request: NextRequest, targetWorkspaceId?: string): Promise<Identity> {
  const identity = await session(request);
  if (!identity) throw new WorkspaceError(401, "Guest session required");
  if (targetWorkspaceId !== undefined && targetWorkspaceId !== identity.workspaceId) throw new WorkspaceError(403, "Workspace membership required");
  return identity;
}
