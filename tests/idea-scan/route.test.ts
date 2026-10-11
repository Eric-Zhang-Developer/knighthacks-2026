import { beforeEach, expect, test, vi } from "vitest";

// GET /api/scan/<versionId> (specs/features/idea-scan, Validation 1) with the database stubbed: workspace scoping,
// the cosine query, ordering and errors. The SQL runs for real only against Neon (verify.py), not here.
const WS = "0b6f5c1e-1111-4a2b-8c3d-000000000001";
const V = "8f0a6f8e-2d39-4c51-9a55-6a1c2b7d9e10";
let identity: { workspaceId: string } | null = { workspaceId: WS };
let results: unknown[][] = [];
const queries: string[] = [];
vi.mock("@/lib/workspace/require", async () => {
  const { WorkspaceError } = await import("@/lib/workspace/tokens");
  return {
    requireWorkspace: async () => {
      if (!identity) throw new WorkspaceError(401, "Guest session required");
      return identity;
    },
  };
});
vi.mock("@/lib/db", () => ({
  db: () => ({
    execute: async (q: { queryChunks?: unknown[] }) => {
      queries.push(JSON.stringify(q.queryChunks ?? q));
      const rows = results.shift();
      if (!rows) throw new Error("db down");
      return { rows };
    },
  }),
}));
vi.mock("next/dist/compiled/server-only", () => ({}));

const { GET } = await import("@/app/api/scan/[versionId]/route");
const get = (id: string) => GET(new Request(`http://x/api/scan/${id}`) as never, { params: Promise.resolve({ versionId: id }) });

beforeEach(() => {
  identity = { workspaceId: WS };
  queries.length = 0;
  results = [];
});

test("the stored neighbours with their cosine similarity, closest first, and the corpus size", async () => {
  results = [
    [{ neighborIds: ["a", "b", "c"], corpusVersion: "2026-10-10-8409" }],
    [
      { id: "b", title: "B", url: "https://devpost.com/software/b", similarity: "0.71", corpusVersion: "2026-10-11-57301" },
      { id: "a", title: "A", url: "https://devpost.com/software/a", similarity: 0.83, corpusVersion: "2026-10-11-57301" },
      { id: "c", title: "C", url: "https://devpost.com/software/c", similarity: 0.76, corpusVersion: "2026-10-11-57301" },
    ],
    [{ n: 0 }],
  ];
  const res = await get(V);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.searched).toBeNull();
  expect(body.corpusVersion).toBe("2026-10-10-8409");
  expect(body.neighbors.map((n: { id: string }) => n.id)).toEqual(["a", "c", "b"]);
  expect(body.neighbors[2]).toEqual({ id: "b", title: "B", url: "https://devpost.com/software/b", similarity: 0.71, corpusVersion: "2026-10-11-57301" });
  expect(queries[0]).toContain("workspace_id"); // scoped to the caller's workspace
  expect(queries[1]).toContain("<=>"); // cosine distance in pgvector, never 3D distance
});

test("a version outside the workspace or malformed is a 404; no session is a 401; a db failure is a 503", async () => {
  results = [[]];
  expect((await get(V)).status).toBe(404);
  expect((await get("not-a-uuid")).status).toBe(404);
  identity = null;
  expect((await get(V)).status).toBe(401);
  identity = { workspaceId: WS };
  results = [];
  expect((await get(V)).status).toBe(503);
});
