import { NextRequest, NextResponse } from "next/server";
import { COOKIE, WorkspaceError } from "./tokens";
export function sameOrigin(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") throw new WorkspaceError(403, "Same-origin request required");
}
export async function body(request: NextRequest): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new WorkspaceError(400, "JSON body required");
  const text = await request.text();
  if (text.length > 4096) throw new WorkspaceError(413, "Request too large");
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch { throw new WorkspaceError(400, "Invalid JSON body"); }
}
export function respond(data: unknown, status = 200, token?: string) {
  const response = NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
  if (token) response.cookies.set(COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  return response;
}
export async function boundary(action: () => Promise<NextResponse>) {
  try { return await action(); }
  catch (error) {
    return error instanceof WorkspaceError ? respond({ error: error.message }, error.status) : respond({ error: "Workspace service unavailable" }, 503);
  }
}
