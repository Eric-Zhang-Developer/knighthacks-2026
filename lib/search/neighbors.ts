import "next/dist/compiled/server-only";
import { and, asc, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/db/schema/corpus";

export type Filters = { event?: string; year?: number };
// summaryOnly: the project has no description on record, only its gallery card. Optional so Hits built from stars.json
// (components/search/filters.ts) still type-check; the server always sets it.
export type Hit = { id: string; title: string; tagline: string | null; event: string | null; year: number | null; summaryOnly?: boolean };
export type Neighbor = Hit & { similarity: number };

const columns = {
  id: projects.id,
  title: projects.title,
  tagline: projects.tagline,
  event: sql<string | null>`${projects.events}->0->>'name'`,
  year: sql<number | null>`case when left(${projects.date}, 4) ~ '^[0-9]{4}$' then left(${projects.date}, 4)::int end`,
  summaryOnly: sql<boolean>`btrim(${projects.description}) = ''`,
};

function where({ event, year }: Filters): SQL | undefined {
  return and(
    event ? sql`${projects.events} @> ${JSON.stringify([{ name: event }])}::jsonb` : undefined,
    year ? sql`left(${projects.date}, 4) = ${String(year)}` : undefined,
  );
}

// Similarity is cosine in embedding space (pgvector `<=>` is cosine distance), never 3D distance. Ideas reuse this.
export async function neighbors(vector: number[], filters: Filters = {}, k = 10): Promise<Neighbor[]> {
  const distance = sql`${projects.embedding} <=> ${`[${vector.join(",")}]`}::vector`;
  const rows = await db()
    .select({ ...columns, similarity: sql<number>`1 - (${distance})` })
    .from(projects)
    .where(where(filters))
    // The expression prevents an approximate HNSW scan from dropping the true nearest match.
    // ponytail: exact scan at 8,409 records; benchmark recall and latency before scaling.
    .orderBy(sql`(${distance}) + 0`)
    .limit(k);
  return rows.map((r) => ({ ...r, similarity: Number(r.similarity) }));
}

// Case-insensitive substring on title; `%`, `_` and `\` in the query match themselves.
export async function titleMatches(q: string, filters: Filters = {}, k = 10): Promise<Hit[]> {
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return db()
    .select(columns)
    .from(projects)
    .where(and(sql`${projects.title} ilike ${pattern}`, where(filters)))
    .orderBy(asc(projects.title))
    .limit(k);
}
