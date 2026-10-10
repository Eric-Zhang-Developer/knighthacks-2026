import { createHash, randomBytes } from "node:crypto";
export const COOKIE = "__Host-uncharted-session";
export const newToken = () => randomBytes(32).toString("base64url");
export const validToken = (token: unknown): token is string => typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export class WorkspaceError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
