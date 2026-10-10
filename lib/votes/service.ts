import "next/dist/compiled/server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { IdeaError } from "@/lib/ideas/contract";
import type { Identity } from "@/lib/workspace/service";

export const voteSchema = z.object({ versionId: z.uuid(), concern: z.string().max(1000).nullable() }).strict();
export type Vote = { versionId: string; concern: string | null; changedAfterReveal: boolean; updatedAt: string };
export type Votes =
  | { mine: Vote | null; theirs: null; revealed: false }
  | { mine: Vote; theirs: Vote; revealed: true; agreement: boolean };

// The only read path. The teammate's row leaves the server only when both rows exist, so no route can leak it early.
export async function readVotes({ workspaceId, memberId }: Identity): Promise<Votes> {
  const result = await db().execute(sql`select member_id as "memberId", version_id as "versionId", concern,
    changed_after_reveal as "changedAfterReveal", updated_at as "updatedAt" from votes where workspace_id = ${workspaceId}::uuid`);
  const rows = result.rows.map((r) => ({ memberId: String(r.memberId), vote: {
    versionId: String(r.versionId), concern: (r.concern as string | null) ?? null, changedAfterReveal: Boolean(r.changedAfterReveal),
    updatedAt: new Date(r.updatedAt as string | Date).toISOString() } }));
  const mine = rows.find((r) => r.memberId === memberId)?.vote ?? null;
  const theirs = rows.find((r) => r.memberId !== memberId)?.vote ?? null;
  if (!mine || !theirs) return { mine, theirs: null, revealed: false };
  return { mine, theirs, revealed: true, agreement: mine.versionId === theirs.versionId };
}

// Upsert in one statement. The version must belong to the caller's workspace. A change of version while the teammate
// has already voted (the pair is revealed) sets changedAfterReveal, and it stays set.
export async function castVote(identity: Identity, versionId: string, concern: string | null): Promise<Votes> {
  const result = await db().execute(sql`insert into votes (member_id, workspace_id, version_id, concern)
    select ${identity.memberId}::uuid, i.workspace_id, v.id, ${concern}
    from idea_versions v join ideas i on i.id = v.idea_id
    where v.id = ${versionId}::uuid and i.workspace_id = ${identity.workspaceId}::uuid
    on conflict (member_id) do update set version_id = excluded.version_id, concern = excluded.concern, updated_at = now(),
      changed_after_reveal = votes.changed_after_reveal or (excluded.version_id <> votes.version_id and exists (
        select 1 from votes other where other.workspace_id = votes.workspace_id and other.member_id <> votes.member_id))
    returning member_id`);
  if (!result.rows.length) throw new IdeaError(404, "Version not found");
  return readVotes(identity);
}
