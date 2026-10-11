import "next/dist/compiled/server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { fieldsSchema, saveSchema } from "@/lib/ideas/contract";
import { claimSchema } from "@/lib/evidence/contract";
import { CRITERIA } from "@/lib/scorecard/contract";
import { tracks } from "@/lib/rubric/contract";
import { embed } from "@/lib/search/embed";
import { neighbors } from "@/lib/search/neighbors";
import type { Identity } from "@/lib/workspace/service";
import { searchRecentNews } from "./news";
import { MentorError, type ToolCall, type ToolData } from "./contract";

const sourceId = z.string().regex(/^[a-f0-9]{40}$/);
const sourceUrl = z.string().max(2048).refine((value) => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
});
const sourceSchema = z.object({ projectId: sourceId, title: z.string().min(1).max(1000), url: sourceUrl,
  excerpt: z.string().min(1).max(6000), corpusVersion: z.string().min(1).max(200) });
// Strip unknown keys at every level; saved JSON must never expand the context allowlist.
const savedClaim = claimSchema.strip();
const cardSchema = sourceSchema.omit({ corpusVersion: true }).extend({
  overlaps: z.array(savedClaim).max(6), differences: z.array(savedClaim).max(6), uncertainty: savedClaim,
});
const criteria = CRITERIA.map((criterion) => ({ ...criterion, source: "specs/context/event.md" }));

async function context(identity: Identity, versionId?: string): Promise<ToolData> {
  const base = { criteria, sponsorPreference: "Ask whether the user wants sponsor challenges before recommending any; a catalog listing is not proof of eligibility or implementation.", tracks: tracks.map(({ id, name, rewards, source }) => ({ id, name, rewards, source })) };
  if (!versionId) return { ...base, saved: null, sourceIds: [] };
  const version = await db().execute(sql`select v.title, v.description, v.audience, v.problem, v.workflow, v.constraints,
    v.corpus_version as "corpusVersion"
    from idea_versions v join ideas i on i.id = v.idea_id
    where v.id = ${versionId}::uuid and i.workspace_id = ${identity.workspaceId}::uuid`);
  const row = version.rows[0];
  if (!row) throw new MentorError(404, "Idea version not found");
  const fields = fieldsSchema.strip().parse(row);
  const corpusVersion = sourceSchema.shape.corpusVersion.parse(row.corpusVersion);
  const stored = await db().execute(sql`select c.project_id as "projectId", c.title, c.url, c.excerpt,
    c."overlaps", c.differences, c.uncertainty
    from evidence_cards c join idea_versions v on v.id = c.version_id join ideas i on i.id = v.idea_id
    where c.version_id = ${versionId}::uuid and i.workspace_id = ${identity.workspaceId}::uuid
    order by array_position(v.neighbor_ids, c.project_id), c.project_id limit 5`);
  const evidence = stored.rows.slice(0, 5).map((card) => cardSchema.parse(card));
  return { ...base, saved: { versionId, fields, corpusVersion, evidence }, sourceIds: evidence.map((card) => card.projectId) };
}

async function findProjects(query: string): Promise<ToolData> {
  // Only the existing embedding service sees the query. Source URLs are data and are never fetched.
  const hits = await neighbors(await embed(query), {}, 5);
  const ids = [...new Set(hits.map((hit) => sourceId.parse(hit.id)))].slice(0, 5);
  if (!ids.length) return { query, projects: [], sourceIds: [] };
  const records = await db().execute(sql`select id, title, url, description, tagline, corpus_version as "corpusVersion"
    from projects where id = any(array(select jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)))`);
  const projects = ids.map((id) => {
    const row = records.rows.find((record) => record.id === id);
    if (!row) throw new MentorError(503, "Project sources are temporarily unavailable. Please retry.");
    const excerpt = [row.description, row.tagline, row.title].find((text) => typeof text === "string" && text.trim());
    return sourceSchema.parse({ projectId: id, title: row.title, url: row.url,
      excerpt: typeof excerpt === "string" ? excerpt.slice(0, 6000) : undefined, corpusVersion: row.corpusVersion });
  });
  return { query, projects, sourceIds: projects.map((project) => project.projectId) };
}

/** Inputs are validated by the API contract; retrieved text stays data, never executable instructions. */
export async function executeTool(identity: Identity, call: ToolCall, sourceIds: ReadonlySet<string>): Promise<ToolData> {
  try {
    if (call.tool === "get_context") return await context(identity, call.args.versionId);
    if (call.tool === "find_projects") return await findProjects(call.args.query);
    if (call.tool === "search_recent_news") return await searchRecentNews(call.args);
    if (call.args.sourceIds.some((id) => !sourceIds.has(id))) throw new MentorError(400, "Proposal cites a source not returned to this session");
    const fields = saveSchema.safeParse(call.args.fields);
    if (!fields.success) throw new MentorError(400, "A proposal needs valid idea fields with some text");
    // The UI alone confirms these exact fields via POST /api/ideas. No writes or generation here.
    return { status: "pending_confirmation", fields: fields.data, rationale: call.args.rationale,
      sourceIds: [...new Set(call.args.sourceIds)] };
  } catch (error) {
    if (error instanceof MentorError) throw error;
    throw new MentorError(503, call.tool === "find_projects"
      ? "Project sources are temporarily unavailable. Please retry."
      : call.tool === "search_recent_news"
        ? "Recent news search is temporarily unavailable. No fresh reports were verified."
        : "Saved mentor context is temporarily unavailable. Please retry.");
  }
}
