import "next/dist/compiled/server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { fieldsSchema } from "@/lib/ideas/contract";
import { WorkspaceError } from "./tokens";

const timestamp = z.string().transform((value) => new Date(value).toISOString());
const claim = z.object({ text: z.string(), label: z.enum(["supported", "inferred", "unverified"]), sourceIds: z.array(z.string()) });
const stateSchema = z.object({
  ideas: z.array(fieldsSchema.extend({ ideaId: z.uuid(), versionId: z.uuid(), parentId: z.uuid().nullable(),
    x: z.number(), y: z.number(), z: z.number(), neighborIds: z.array(z.string()), corpusVersion: z.string(), createdAt: timestamp }).strip()).max(50),
  challenges: z.array(z.object({ versionId: z.uuid(), sessionId: z.uuid(), perspective: z.enum(["user", "judge", "engineer"]),
    state: z.enum(["idle", "generating", "awaiting", "answering"]), rounds: z.array(z.object({
      round: z.number().int().min(1).max(3), status: z.string(), question: z.string().nullable(), assumption: z.string().nullable(),
      source: claim.nullable(), answer: z.string().nullable(), outcome: z.string().nullable(),
    })).max(3) })).max(50),
  snapshots: z.array(z.object({ id: z.uuid(), versionId: z.uuid(), createdAt: timestamp })).max(50),
  shares: z.array(z.object({ id: z.string().regex(/^[0-9a-f]{16}$/), snapshotId: z.uuid(), createdAt: timestamp, revokedAt: timestamp.nullable() })).max(50),
});
export type WorkspaceState = z.infer<typeof stateSchema>;

export async function workspaceState(workspaceId: string): Promise<WorkspaceState> {
  // One statement gives every list the same database snapshot. Shared scoped CTEs
  // avoid per-idea queries; only public columns enter the JSON projections.
  const result = await db().execute(sql`with scoped_versions as materialized (
    select v."idea_id" as "ideaId", v."id" as "versionId", v."parent_id" as "parentId",
      v."title", v."description", v."audience", v."problem", v."workflow", v."constraints",
      v."x", v."y", v."z", v."neighbor_ids" as "neighborIds", v."corpus_version" as "corpusVersion", v."created_at" as "createdAt"
    from "idea_versions" v join "ideas" i on i."id" = v."idea_id" where i."workspace_id" = ${workspaceId}::uuid
  ), latest_ideas as (
    select distinct on ("ideaId") * from scoped_versions order by "ideaId", "createdAt" desc, "versionId" desc
  ), listed_ideas as (
    select * from latest_ideas order by "createdAt" desc, "versionId" desc limit 50
  ), latest_sessions as (
    select distinct on (s."version_id") s."version_id" as "versionId", s."id" as "sessionId", s."perspective", s."state", s."created_at"
    from "challenge_sessions" s join scoped_versions v on v."versionId" = s."version_id"
    order by s."version_id", s."created_at" desc, s."id" desc
  ), listed_sessions as materialized (
    select * from latest_sessions order by "created_at" desc, "sessionId" desc limit 50
  ), rounds as (
    select r."session_id", jsonb_agg(jsonb_build_object('round', r."round", 'status', r."status", 'question', r."question",
      'assumption', r."assumption", 'source', r."source", 'answer', r."answer", 'outcome', r."outcome") order by r."round") as data
    from "challenge_rounds" r join listed_sessions s on s."sessionId" = r."session_id" group by r."session_id"
  ), scoped_snapshots as materialized (
    select "id", "data"->>'versionId' as "versionId", "created_at" as "createdAt" from "snapshots" where "workspace_id" = ${workspaceId}::uuid
  ), listed_snapshots as (
    select * from scoped_snapshots order by "createdAt" desc, "id" desc limit 50
  ), listed_shares as (
    select left(s."token_hash", 16) as "id", s."snapshot_id" as "snapshotId", s."created_at" as "createdAt", s."revoked_at" as "revokedAt"
    from "shares" s join scoped_snapshots p on p."id" = s."snapshot_id" order by s."created_at" desc, s."token_hash" desc limit 50
  ) select
    coalesce((select jsonb_agg(to_jsonb(i) order by i."createdAt" desc, i."versionId" desc) from listed_ideas i), '[]'::jsonb) as ideas,
    coalesce((select jsonb_agg(jsonb_build_object('versionId', s."versionId", 'sessionId', s."sessionId", 'perspective', s."perspective",
      'state', s."state", 'rounds', coalesce(r.data, '[]'::jsonb)) order by s."created_at" desc, s."sessionId" desc)
      from listed_sessions s left join rounds r on r."session_id" = s."sessionId"), '[]'::jsonb) as challenges,
    coalesce((select jsonb_agg(to_jsonb(p) order by p."createdAt" desc, p."id" desc) from listed_snapshots p), '[]'::jsonb) as snapshots,
    coalesce((select jsonb_agg(to_jsonb(s) order by s."createdAt" desc, s."id" desc) from listed_shares s), '[]'::jsonb) as shares`);
  return stateSchema.parse(result.rows[0]);
}

export async function revokeListedShare(workspaceId: string, id: string) {
  if (!/^[0-9a-f]{16}$/.test(id)) throw new WorkspaceError(404, "Share not found");
  // Count within this workspace before updating. A prefix collision must never
  // revoke two links. COALESCE preserves the timestamp on concurrent repeats.
  const result = await db().execute(sql`with candidates as materialized (
    select s."token_hash" from "shares" s join "snapshots" p on p."id" = s."snapshot_id"
    where p."workspace_id" = ${workspaceId}::uuid and left(s."token_hash", 16) = ${id} limit 2
  ), changed as (
    update "shares" s set "revoked_at" = coalesce(s."revoked_at", now())
    where (select count(*) from candidates) = 1 and s."token_hash" = (select "token_hash" from candidates limit 1)
    returning s."revoked_at"
  ) select (select count(*)::int from candidates) as count, (select "revoked_at" from changed) as "revokedAt"`);
  const row = result.rows[0];
  if (!row || Number(row.count) === 0) throw new WorkspaceError(404, "Share not found");
  if (Number(row.count) !== 1) throw new WorkspaceError(409, "Share identifier is ambiguous");
  if (!row.revokedAt) throw new Error("Share revocation could not be confirmed");
  return { revokedAt: new Date(row.revokedAt as string | Date).toISOString() };
}
