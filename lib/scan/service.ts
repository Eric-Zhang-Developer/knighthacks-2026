import "next/dist/compiled/server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// The idea scan (specs/features/idea-scan): a version's stored neighbours with their real similarity, for the galaxy
// to label its arcs. Read only, no model call. Similarity is cosine between the stored embeddings (pgvector `<=>` is
// cosine distance), never 3D distance.
export type ScanNeighbor = { id: string; title: string; url: string; similarity: number; corpusVersion: string };
export type Scan = { versionId: string; corpusVersion: string; searched: number | null; neighbors: ScanNeighbor[] };

export class ScanError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function scanOf(workspaceId: string, versionId: string): Promise<Scan> {
  // The version must belong to this workspace; one outside it is indistinguishable from a missing one.
  const found = await db().execute(sql`select v.neighbor_ids as "neighborIds", v.corpus_version as "corpusVersion"
    from idea_versions v join ideas i on i.id = v.idea_id
    where v.id = ${versionId}::uuid and i.workspace_id = ${workspaceId}::uuid limit 1`);
  const version = found.rows[0] as { neighborIds: string[]; corpusVersion: string } | undefined;
  if (!version) throw new ScanError(404, "Idea version not found");
  const ids = version.neighborIds;
  const rows = await db().execute(sql`select p.id, p.title, p.url, p.corpus_version as "corpusVersion", 1 - (p.embedding <=> v.embedding) as similarity
    from projects p, idea_versions v
    where v.id = ${versionId}::uuid and p.id = any(array(select jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)))`);
  const counted = await db().execute(sql`select count(*)::int as n from projects where corpus_version = ${version.corpusVersion}`);
  const neighbors = rows.rows
    .map((r) => ({ id: String(r.id), title: String(r.title), url: String(r.url), similarity: Number(r.similarity), corpusVersion: String(r.corpusVersion) }))
    .filter((n) => Number.isFinite(n.similarity))
    .sort((a, b) => b.similarity - a.similarity);
  const liveCount = Number(counted.rows[0]?.n ?? 0);
  // A corpus release replaces the prior rows. When that happens the historical count is unavailable: never infer it
  // from an arbitrary version label or report the database's zero as though the original scan searched no projects.
  const searched = liveCount > 0 ? liveCount : null;
  return { versionId, corpusVersion: version.corpusVersion, searched, neighbors };
}
