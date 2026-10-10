import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { hashToken, newToken, WorkspaceError } from "./tokens";
export type Identity = { workspaceId: string; memberId: string };
export async function lookupSession(token: string): Promise<Identity | null> {
  const result = await db().execute(sql`select workspace_id as "workspaceId", id as "memberId" from members where session_hash = ${hashToken(token)} limit 1`);
  return (result.rows[0] as Identity | undefined) ?? null;
}
export async function createWorkspace() {
  const identity: Identity = { workspaceId: randomUUID(), memberId: randomUUID() };
  const token = newToken();
  await db().execute(sql`with created as (
    insert into workspaces(id) values (${identity.workspaceId}::uuid) returning id
  ) insert into members(id, workspace_id, seat, session_hash)
    select ${identity.memberId}::uuid, id, 1, ${hashToken(token)} from created`);
  return { identity, token };
}
export async function createInvite(identity: Identity) {
  const token = newToken();
  const result = await db().execute(sql`insert into invites(token_hash, workspace_id, expires_at)
    select ${hashToken(token)}, id, now() + interval '24 hours' from workspaces
    where id = ${identity.workspaceId}::uuid and member_count = 1 returning expires_at as "expiresAt"`);
  if (!result.rows.length) throw new WorkspaceError(409, "Workspace already has two members");
  return { token, expiresAt: result.rows[0].expiresAt };
}
export async function redeemInvite(inviteToken: string, caller: Identity | null) {
  const token = newToken();
  const memberId = randomUUID();
  // The workspace UPDATE is the serialization point even when different invite
  // tokens race. PostgreSQL rechecks member_count after waiting for its row lock.
  // Every write below is one atomic statement; no interactive HTTP transaction.
  const result = await db().execute(sql`with reserved as (
    update workspaces w set member_count = 2
    where w.member_count = 1
      and (${caller?.workspaceId ?? null}::uuid is null or w.id <> ${caller?.workspaceId ?? null}::uuid)
      and exists (select 1 from invites i where i.workspace_id = w.id and i.token_hash = ${hashToken(inviteToken)} and i.used_at is null and i.expires_at > now())
    returning w.id
  ), joined as (
    insert into members(id, workspace_id, seat, session_hash)
    select ${memberId}::uuid, id, 2, ${hashToken(token)} from reserved returning workspace_id
  ), consumed as (
    update invites set used_at = now() where token_hash = ${hashToken(inviteToken)} and used_at is null and expires_at > now() and workspace_id in (select workspace_id from joined) returning workspace_id
  ) select workspace_id as "workspaceId" from consumed`);
  if (!result.rows.length) throw new WorkspaceError(410, "Invite unavailable, expired, or already used");
  return { identity: { workspaceId: String(result.rows[0].workspaceId), memberId }, token };
}
