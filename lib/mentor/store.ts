import "next/dist/compiled/server-only";
import { createHash, randomUUID } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import type { Identity } from "@/lib/workspace/service";
import { canonical, MentorError, type ToolCall, type ToolData } from "./contract";

const digestFor = (call: ToolCall) => createHash("sha256").update(canonical(call)).digest("hex");
const cancelled = () => new MentorError(409, "Mentor session ended or expired; tool result cancelled");
type StoredCall = { digest: string; reservationId: string; turnId: number; tool: ToolCall["tool"]; status: "pending" | "completed"; data?: ToolData };
type Reservation = { status: "run"; sourceIds: Set<string> } | { status: "replay"; data: ToolData } | { status: "pending" };
async function execute(statement: SQL) {
  try { return await db().execute(statement); }
  catch { throw new MentorError(503, "Mentor session storage is temporarily unavailable. Please retry."); }
}

export async function reserveSession(identity: Identity): Promise<string> {
  const id = randomUUID();
  // ON CONFLICT locks the current budget tuple and rechecks both counts after concurrent updates.
  // Counting session rows under an advisory lock would instead retain the statement's older snapshot.
  const result = await execute(sql`with budget as (
    insert into mentor_budgets(workspace_id, events)
    select ${identity.workspaceId}::uuid, jsonb_build_array(jsonb_build_object('memberId', ${identity.memberId}::text, 'at', extract(epoch from now())))
    where exists (select 1 from members where id = ${identity.memberId}::uuid and workspace_id = ${identity.workspaceId}::uuid)
    on conflict (workspace_id) do update
    set events = coalesce((select jsonb_agg(event) from jsonb_array_elements(mentor_budgets.events) event
      where (event->>'at')::numeric > extract(epoch from now() - interval '1 hour')), '[]'::jsonb) || excluded.events
    where (select count(*) from jsonb_array_elements(mentor_budgets.events) event
      where (event->>'at')::numeric > extract(epoch from now() - interval '1 hour')) < 12
      and (select count(*) from jsonb_array_elements(mentor_budgets.events) event
        where event->>'memberId' = ${identity.memberId}::text and (event->>'at')::numeric > extract(epoch from now() - interval '10 minutes')) < 3
    returning workspace_id
  ) insert into mentor_sessions(id, workspace_id, member_id, expires_at)
    select ${id}::uuid, workspace_id, ${identity.memberId}::uuid, now() + interval '20 minutes' from budget returning id`);
  if (!result.rows.length) throw new MentorError(429, "Mentor session limit reached. Please try again later.");
  return id;
}

export async function endSession(identity: Identity, id: string): Promise<void> {
  const result = await execute(sql`update mentor_sessions set ended_at = coalesce(ended_at, now())
    where id = ${id}::uuid and workspace_id = ${identity.workspaceId}::uuid and member_id = ${identity.memberId}::uuid returning id`);
  if (!result.rows.length) throw new MentorError(404, "Mentor session not found");
}

export async function reserveTool(identity: Identity, call: ToolCall): Promise<Reservation> {
  const digest = digestFor(call);
  const reservationId = randomUUID();
  const entry: StoredCall = { digest, reservationId, turnId: call.turnId, tool: call.tool, status: "pending" };
  const result = await execute(sql`update mentor_sessions s
    set calls = case when s.calls ? ${call.callId} then s.calls else s.calls || jsonb_build_object(${call.callId}::text, ${JSON.stringify(entry)}::jsonb) end
    where s.id = ${call.sessionId}::uuid and s.workspace_id = ${identity.workspaceId}::uuid and s.member_id = ${identity.memberId}::uuid
      and s.ended_at is null and s.expires_at > clock_timestamp()
      and (s.calls ? ${call.callId} or ((select count(*) from jsonb_object_keys(s.calls)) < 40
        and (select count(*) from jsonb_each(s.calls) c where (c.value->>'turnId')::int = ${call.turnId}) < 8))
    returning s.calls->${call.callId} as entry, s.source_ids as "sourceIds"`);
  const row = result.rows[0];
  if (!row) {
    const current = await execute(sql`select ended_at as "endedAt", expires_at <= clock_timestamp() as expired from mentor_sessions
      where id = ${call.sessionId}::uuid and workspace_id = ${identity.workspaceId}::uuid and member_id = ${identity.memberId}::uuid`);
    if (!current.rows[0]) throw new MentorError(404, "Mentor session not found");
    if (current.rows[0].endedAt || current.rows[0].expired) throw cancelled();
    throw new MentorError(429, "Mentor tool limit reached for this turn or session");
  }
  const stored = row.entry as StoredCall;
  if (stored.digest !== digest) throw new MentorError(409, "Tool call ID was already used for different arguments");
  if (stored.status === "completed") return { status: "replay", data: stored.data! };
  // A unique reservation marker distinguishes the winner from identical pending redeliveries.
  return stored.reservationId === reservationId
    ? { status: "run", sourceIds: new Set(row.sourceIds as string[]) } : { status: "pending" };
}

export async function completeTool(identity: Identity, call: ToolCall, data: ToolData): Promise<void> {
  const serialized = JSON.stringify(data);
  if (Buffer.byteLength(serialized, "utf8") > 128 * 1024) throw new MentorError(503, "Mentor tool result exceeds its safe size limit");
  const sourceIds = (call.tool === "get_context" || call.tool === "find_projects") && Array.isArray(data.sourceIds)
    ? [...new Set(data.sourceIds.filter((id): id is string => typeof id === "string" && /^[a-f0-9]{40}$/.test(id)))].slice(0, 5) : [];
  const result = await execute(sql`update mentor_sessions s
    set calls = jsonb_set(s.calls, array[${call.callId}::text], (s.calls->${call.callId}) || jsonb_build_object('status', 'completed', 'data', ${serialized}::jsonb)),
      source_ids = (select coalesce(jsonb_agg(distinct source), '[]'::jsonb) from jsonb_array_elements(s.source_ids || ${JSON.stringify(sourceIds)}::jsonb) source)
    where s.id = ${call.sessionId}::uuid and s.workspace_id = ${identity.workspaceId}::uuid and s.member_id = ${identity.memberId}::uuid
      and s.ended_at is null and s.expires_at > clock_timestamp()
      and s.calls->${call.callId}->>'digest' = ${digestFor(call)} and s.calls->${call.callId}->>'status' = 'pending'
    returning id`);
  if (!result.rows.length) throw cancelled();
}

export async function failTool(identity: Identity, call: ToolCall): Promise<void> {
  // Persist a safe terminal result, so retries cannot spend another provider request.
  await completeTool(identity, call, { status: "failed", error: "Mentor tool is temporarily unavailable. Please retry with a new turn." });
}
