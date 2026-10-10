import { z } from "zod";
import { embed } from "@/lib/search/embed";
import { neighbors, titleMatches } from "@/lib/search/neighbors";

export const dynamic = "force-dynamic";

const Query = z.object({
  q: z.string().trim().min(1).max(500),
  event: z.string().trim().min(1).max(200).optional(),
  year: z.coerce.number().int().min(1990).max(2100).optional(),
});

// GET /api/search?q=&event=&year= -> { results (by meaning, with similarity), textMatches (title), meaning }.
// An embedding failure still answers with text matches and meaning: "unavailable".
export async function GET(req: Request) {
  const params = Object.fromEntries([...new URL(req.url).searchParams].filter(([, v]) => v !== ""));
  const parsed = Query.safeParse(params);
  if (!parsed.success) return Response.json({ error: "q is required, up to 500 characters" }, { status: 400 });
  const { q, ...filters } = parsed.data;
  try {
    const [vector, textMatches] = await Promise.all([embed(q).catch(() => null), titleMatches(q, filters)]);
    const results = vector ? await neighbors(vector, filters) : [];
    return Response.json({ results, textMatches, meaning: vector ? "ok" : "unavailable" });
  } catch {
    return Response.json({ error: "search unavailable" }, { status: 503 });
  }
}
