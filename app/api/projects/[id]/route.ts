import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/db/schema/corpus";

export const dynamic = "force-dynamic";

// The drawer's fields only: never the embedding.
const columns = {
  id: projects.id,
  url: projects.url,
  title: projects.title,
  tagline: projects.tagline,
  description: projects.description,
  technologies: projects.technologies,
  events: projects.events,
  date: projects.date,
  dateKind: projects.dateKind,
};

// GET /api/projects/:id -> the record from `projects`, 404 for an unknown id.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Ids are sha1 hex (db/schema/corpus.ts); anything else cannot exist.
  if (!/^[0-9a-f]{40}$/.test(id)) return Response.json({ error: "not found" }, { status: 404 });
  try {
    const [row] = await db().select(columns).from(projects).where(eq(projects.id, id)).limit(1);
    if (!row) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json(row);
  } catch {
    return Response.json({ error: "project unavailable" }, { status: 503 });
  }
}
