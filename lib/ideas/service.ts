import "next/dist/compiled/server-only";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { embed } from "@/lib/search/embed";
import { neighbors } from "@/lib/search/neighbors";
import { IdeaError, type IdeaFields, type IdeaVersion } from "./contract";

const columns = sql`v.idea_id as "ideaId", v.id as "versionId", v.parent_id as "parentId",
 v.title, v.description, v.audience, v.problem, v.workflow, v.constraints,
 v.x, v.y, v.z, v.neighbor_ids as "neighborIds", v.corpus_version as "corpusVersion", v.created_at as "createdAt"`;
function publicVersion(row: Record<string, unknown>): IdeaVersion {
  return { ...row, createdAt: new Date(row.createdAt as string | Date).toISOString() } as IdeaVersion;
}
async function existing(workspaceId: string, key: string) {
  const result = await db().execute(sql`select ${columns} from ideas i join idea_versions v on v.idea_id = i.id
    where i.workspace_id = ${workspaceId}::uuid and i.idempotency_key = ${key} and v.parent_id is null limit 1`);
  return result.rows[0] ? publicVersion(result.rows[0]) : null;
}
export async function listIdeas(workspaceId: string) {
  const result = await db().execute(sql`select distinct on (i.id) ${columns}
    from ideas i join idea_versions v on v.idea_id = i.id
    where i.workspace_id = ${workspaceId}::uuid order by i.id, v.created_at desc, v.id desc`);
  return result.rows.map(publicVersion);
}
export async function createIdea(workspaceId: string, key: string, fields: IdeaFields) {
  const previous = await existing(workspaceId, key);
  if (previous) return { version: previous, created: false };
  const text = Object.entries(fields).filter(([, value]) => value !== null).map(([name, value]) => `${name}: ${value}`).join("\n");
  const vector = await embed(text);
  if (vector.length !== 1024 || !vector.every(Number.isFinite) || Math.hypot(...vector) === 0) throw new IdeaError(503, "Idea embedding unavailable. Please try again.");
  const hits = await neighbors(vector, {}, 5);
  const ids = hits.map((hit) => hit.id);
  if (new Set(ids).size !== 5) throw new IdeaError(503, "Five corpus neighbors are required to place this idea. Please try again.");
  const neighborArray = sql`array(select jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb))`;
  const coordinates = await db().execute(sql`select id, x, y, z, corpus_version as "corpusVersion" from projects where id = any(${neighborArray})`);
  const points = coordinates.rows;
  if (points.length !== 5 || points.some((point) => !ids.includes(String(point.id)) ||
    ![point.x, point.y, point.z].every((n) => typeof n === "number" && Number.isFinite(n)) ||
    typeof point.corpusVersion !== "string" || !point.corpusVersion) || new Set(points.map((p) => p.corpusVersion)).size !== 1) {
    throw new IdeaError(503, "Corpus placement is unavailable. Please try again.");
  }
  const mean = (axis: "x" | "y" | "z") => points.reduce((sum, point) => sum + Number(point[axis]) / 5, 0);
  const ideaId = randomUUID(), versionId = randomUUID();
  // Both INSERTs commit together. A concurrent conflict waits for the winner;
  // its row may be absent from this statement's snapshot, so read it afterward.
  const inserted = await db().execute(sql`with new_idea as (
    insert into ideas(id, workspace_id, idempotency_key) values (${ideaId}::uuid, ${workspaceId}::uuid, ${key})
    on conflict (workspace_id, idempotency_key) do nothing returning id
  ), new_version as (
    insert into idea_versions(id, idea_id, parent_id, title, description, audience, problem, workflow, constraints,
      embedding, x, y, z, neighbor_ids, corpus_version)
    select ${versionId}::uuid, id, null, ${fields.title}, ${fields.description}, ${fields.audience}, ${fields.problem}, ${fields.workflow}, ${fields.constraints},
      ${`[${vector.join(",")}]`}::vector, ${mean("x")}, ${mean("y")}, ${mean("z")}, ${neighborArray}, ${String(points[0].corpusVersion)}
    from new_idea returning *
  ) select ${columns} from new_version v`);
  if (inserted.rows[0]) return { version: publicVersion(inserted.rows[0]), created: true };
  const winner = await existing(workspaceId, key);
  if (!winner) throw new IdeaError(503, "Idea save could not be confirmed. Retry with the same key.");
  return { version: winner, created: false };
}
