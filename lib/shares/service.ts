import "next/dist/compiled/server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { SnapshotData } from "@/lib/snapshots/contract";
import { newToken, hashToken, validToken, ShareError } from "./tokens";
export async function createShare(workspaceId: string, snapshotId: string) {
  const token = newToken();
  const result = await db().execute(sql`insert into "shares" ("token_hash", "snapshot_id")
    select ${hashToken(token)}, s."id" from "snapshots" s where s."id" = ${snapshotId}::uuid and s."workspace_id" = ${workspaceId}::uuid returning "snapshot_id"`);
  if (!result.rows.length) throw new ShareError(404, "Snapshot not found");
  return token;
}
export async function readShare(token: string): Promise<SnapshotData> {
  if (!validToken(token)) throw new ShareError(404, "Share not found");
  const result = await db().execute(sql`select s."revoked_at" as "revokedAt", case when s."revoked_at" is null then p."data" else null end as "data"
    from "shares" s join "snapshots" p on p."id" = s."snapshot_id" where s."token_hash" = ${hashToken(token)}`);
  if (!result.rows[0]) throw new ShareError(404, "Share not found");
  if (result.rows[0].revokedAt !== null) throw new ShareError(410, "revoked");
  return result.rows[0].data as SnapshotData;
}
export async function revokeShare(workspaceId: string, token: string) {
  if (!validToken(token)) throw new ShareError(404, "Share not found");
  const result = await db().execute(sql`update "shares" s set "revoked_at" = coalesce(s."revoked_at", now()) from "snapshots" p
    where s."snapshot_id" = p."id" and s."token_hash" = ${hashToken(token)} and p."workspace_id" = ${workspaceId}::uuid returning s."snapshot_id"`);
  if (!result.rows.length) throw new ShareError(404, "Share not found");
}
