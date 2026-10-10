import "next/dist/compiled/server-only";
import { createHash, randomBytes } from "node:crypto";
export const newToken = () => randomBytes(16).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export function validToken(token: string) {
  return /^[A-Za-z0-9_-]{22}$/.test(token) && Buffer.from(token, "base64url").toString("base64url") === token;
}
export class ShareError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
