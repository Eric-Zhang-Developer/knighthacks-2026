import "next/dist/compiled/server-only";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { createEvidence } from "@/lib/evidence/service";
import { SnapshotError, type SnapshotData } from "./contract";
export async function createSnapshot(workspaceId: string, versionId: string) {
  // The chosen version may never have been opened in the evidence panel.
  // This authorizes the version and reuses saved cards, generating only missing
  // top-three cards. A failed batch must not freeze an incomplete choice.
  await createEvidence(workspaceId, versionId, false);
  const snapshotId = randomUUID();
  // Scope was added after snapshots shipped. A release can briefly run this code
  // before the additive decision-context tables are applied; unscoped snapshots
  // must remain available during that window. Once either scope table exists we
  // require both, so a partial rollout fails visibly instead of dropping a saved
  // selection from the immutable snapshot.
  const capabilities = await db().execute(sql`select
    to_regclass('public.scope_selections') is not null as "scopeSelections",
    to_regclass('public.scope_recommendations') is not null as "scopeRecommendations",
    to_regclass('public.experiments') is not null as "experiments"`);
  const available = capabilities.rows[0] as { scopeSelections?: boolean; scopeRecommendations?: boolean; experiments?: boolean } | undefined;
  if (available?.scopeSelections !== available?.scopeRecommendations) {
    throw new SnapshotError(503, "Snapshots are temporarily unavailable");
  }
  const nextTest = available?.experiments ? sql`coalesce(
    (select jsonb_build_object('text', e."procedure", 'label', 'unverified', 'sourceIds', '[]'::jsonb)
      from "experiments" e join "challenge_sessions" es on es."id" = e."session_id"
      where es."version_id" = v."id"
      order by e."updated_at" desc, e."id" desc limit 1),
    (select r."source" from "challenge_sessions" s join "challenge_rounds" r on r."session_id" = s."id"
      where s."version_id" = v."id" and r."source"->>'label' = 'unverified' and r."source"->'sourceIds' = '[]'::jsonb
        and left(r."source"->>'text', 15) = 'Proposed test: '
        and length(trim(substring(r."source"->>'text' from 16))) > 0
      order by s."created_at" desc, s."id" desc, r."round" desc limit 1))` : sql`
    (select r."source" from "challenge_sessions" s join "challenge_rounds" r on r."session_id" = s."id"
      where s."version_id" = v."id" and r."source"->>'label' = 'unverified' and r."source"->'sourceIds' = '[]'::jsonb
        and left(r."source"->>'text', 15) = 'Proposed test: '
        and length(trim(substring(r."source"->>'text' from 16))) > 0
      order by s."created_at" desc, s."id" desc, r."round" desc limit 1)`;
  const scope = available?.scopeSelections ? sql`|| coalesce((select jsonb_build_object('scope', jsonb_build_object('selectionId', sel."id",
      'features', (select jsonb_agg(jsonb_build_object('id', f->>'id', 'title', f->'title', 'demoStep', f->'demoStep') order by o)
        from jsonb_array_elements(rec."features") with ordinality as x(f, o)),
      'choices', sel."choices", 'demoSketch', sel."demo_sketch"))
    from "scope_selections" sel join "scope_recommendations" rec on rec."id" = sel."recommendation_id"
    where sel."version_id" = v."id" order by sel."revision" desc limit 1), '{}'::jsonb)` : sql``;
  // One statement sees one consistent source snapshot and persists only this
  // explicit allowlist. No joins to votes or transcript copying. The latest committed
  // scope (decision-context-api) is frozen here too: feature ids, titles, demo steps and
  // choices only, never the profile or its explanations; no saved scope adds no key.
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
      'nextTest', ${nextTest}
    ) ${scope}
    from "idea_versions" v join "ideas" i on i."id" = v."idea_id"
    where v."id" = ${versionId}::uuid and i."workspace_id" = ${workspaceId}::uuid returning "data"`);
  if (!result.rows[0]) throw new SnapshotError(404, "Idea version not found");
  return { snapshotId, data: result.rows[0].data as SnapshotData };
}
export async function getSnapshot(workspaceId: string, snapshotId: string): Promise<SnapshotData> {
  const result = await db().execute(sql`select "data" from "snapshots" where "id" = ${snapshotId}::uuid and "workspace_id" = ${workspaceId}::uuid`);
  if (!result.rows[0]) throw new SnapshotError(404, "Snapshot not found");
  return result.rows[0].data as SnapshotData;
}
