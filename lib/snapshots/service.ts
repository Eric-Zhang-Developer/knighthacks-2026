import "next/dist/compiled/server-only";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { SnapshotError, type SnapshotData } from "./contract";
export async function createSnapshot(workspaceId: string, versionId: string) {
  const snapshotId = randomUUID();
  // One statement sees one consistent source snapshot and persists only this
  // explicit allowlist. No model calls, joins to votes, or transcript copying.
  const result = await db().execute(sql`insert into "snapshots" ("id", "workspace_id", "data")
    select ${snapshotId}::uuid, i."workspace_id", jsonb_build_object(
      'versionId', v."id", 'idea', jsonb_build_object('title', v."title", 'description', v."description",
        'problem', v."problem", 'workflow', v."workflow", 'constraints', v."constraints"), 'audience', v."audience",
      'nearestAlternatives', coalesce((select jsonb_agg(jsonb_build_object('projectId', n."id", 'title', coalesce(e."title", p."title"), 'url', coalesce(e."url", p."url")) order by n."ordinal")
        from unnest(v."neighbor_ids") with ordinality as n("id", "ordinal")
        left join "evidence_cards" e on e."version_id" = v."id" and e."project_id" = n."id"
        left join "projects" p on p."id" = n."id" and p."corpus_version" = v."corpus_version"), '[]'::jsonb),
      'whatDiffers', coalesce((select jsonb_agg(jsonb_build_object('projectId', n."id", 'claims', e."differences") order by n."ordinal")
        from unnest(v."neighbor_ids") with ordinality as n("id", "ordinal")
        join "evidence_cards" e on e."version_id" = v."id" and e."project_id" = n."id"), '[]'::jsonb),
      'mainUncertainty', (select jsonb_build_object('projectId', n."id", 'claim', e."uncertainty")
        from unnest(v."neighbor_ids") with ordinality as n("id", "ordinal")
        join "evidence_cards" e on e."version_id" = v."id" and e."project_id" = n."id"
        order by n."ordinal" limit 1),
      'nextTest', (select r."source" from "challenge_sessions" s join "challenge_rounds" r on r."session_id" = s."id"
        where s."version_id" = v."id" and r."source"->>'label' = 'unverified' and r."source"->'sourceIds' = '[]'::jsonb
          and left(r."source"->>'text', 15) = 'Proposed test: '
          and length(trim(substring(r."source"->>'text' from 16))) > 0
        order by s."created_at" desc, s."id" desc, r."round" desc limit 1)
    ) from "idea_versions" v join "ideas" i on i."id" = v."idea_id"
    where v."id" = ${versionId}::uuid and i."workspace_id" = ${workspaceId}::uuid returning "data"`);
  if (!result.rows[0]) throw new SnapshotError(404, "Idea version not found");
  return { snapshotId, data: result.rows[0].data as SnapshotData };
}
export async function getSnapshot(workspaceId: string, snapshotId: string): Promise<SnapshotData> {
  const result = await db().execute(sql`select "data" from "snapshots" where "id" = ${snapshotId}::uuid and "workspace_id" = ${workspaceId}::uuid`);
  if (!result.rows[0]) throw new SnapshotError(404, "Snapshot not found");
  return result.rows[0].data as SnapshotData;
}
