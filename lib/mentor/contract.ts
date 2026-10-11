import { createHash } from "node:crypto";
import { z } from "zod";
import { fieldsSchema } from "@/lib/ideas/contract";

export class MentorError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

const identity = { sessionId: z.uuid(), turnId: z.number().int().min(0).max(1000), callId: z.string().regex(/^[a-f0-9]{64}$/) };
export const toolSchema = z.discriminatedUnion("tool", [
  z.object({ ...identity, tool: z.literal("get_context"), args: z.object({ versionId: z.uuid().optional() }).strict() }).strict(),
  z.object({ ...identity, tool: z.literal("find_projects"), args: z.object({ query: z.string().trim().min(1).max(2000) }).strict() }).strict(),
  z.object({ ...identity, tool: z.literal("propose_idea"), args: z.object({ fields: fieldsSchema, rationale: z.string().trim().min(1).max(800), sourceIds: z.array(z.string().min(1).max(200)).max(5) }).strict() }).strict(),
]);
export type ToolCall = z.infer<typeof toolSchema>;
export type ToolData = Record<string, unknown>;

/** Browser uses this same sorted-key JSON algorithm before SHA-256; IDs are not SDK callback fields. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
export function callIdFor(call: Omit<ToolCall, "callId">): string {
  return createHash("sha256").update(`${call.sessionId}:${call.turnId}:${call.tool}:${canonical(call.args)}`).digest("hex");
}
