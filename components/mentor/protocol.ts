import { FIELDS, type Fields } from "@/components/idea/fields";

export function readFields(value: unknown): Fields {
  if (!value || typeof value !== "object") throw new Error("The idea response was incomplete. Your message is kept.");
  const source = value as Record<string, unknown>;
  const fields = Object.fromEntries(FIELDS.map(({ name }) => {
    const field = source[name];
    if (field !== null && typeof field !== "string") throw new Error("The idea response was incomplete. Your message is kept.");
    return [name, field];
  })) as Fields;
  if (!Object.values(fields).some((v) => v?.trim())) throw new Error("There is not enough detail to propose an idea yet.");
  return fields;
}

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}

export async function toolIdentity(sessionId: string, turnId: number, tool: string, args: unknown) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${sessionId}:${turnId}:${tool}:${canonical(args)}`));
  return Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("");
}

export async function request(path: string, body?: unknown, signal?: AbortSignal, headers?: Record<string, string>) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body ?? {}), signal });
  const data = await response.json().catch(() => null);
  if (response.status === 429 && path === "/api/mentor/session") throw new Error("Call-start limit reached: up to 3 attempts per 10 minutes and 12 per workspace per hour. Failed connections also count. Wait for the window to reset; refreshing will not reset it. You can keep typing.");
  if (!response.ok) throw new Error(response.status === 404 || response.status === 503 ? "This service is not available yet. Your conversation is kept; you can continue typing." : typeof data?.error === "string" ? data.error : "That request did not finish. Your conversation is kept.");
  return data;
}
