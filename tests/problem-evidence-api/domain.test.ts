import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ execute: vi.fn(), groundedSearch: vi.fn(), generate: vi.fn(), resolveSource: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: () => ({ execute: mocks.execute }) }));
vi.mock("@/lib/ai/generate", () => ({ generate: mocks.generate }));
vi.mock("@/lib/ai/grounded", () => ({ groundedSearch: mocks.groundedSearch }));
vi.mock("@/lib/problem-evidence/page", () => ({ resolveSource: mocks.resolveSource }));
import { createEvidence } from "@/lib/problem-evidence/service";
import { PgDialect } from "drizzle-orm/pg-core";

let saved: { items: { source: { title: string; domain: string; url: string | null } }[] };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.execute.mockImplementation(async (query) => {
    const sql = new PgDialect().sqlToQuery(query);
    if (sql.sql.startsWith("select v.problem")) return { rows: [{ problem: "A real problem" }] };
    if (sql.sql.startsWith("insert")) { saved = JSON.parse(sql.params[1] as string); return { rows: [] }; }
    return { rows: saved ? [{ data: saved }] : [] };
  });
  saved = undefined!;
  mocks.generate.mockResolvedValue({ items: [{ id: "s0-c0", about: "problem", relevance: "Relevant to the problem" }] });
  mocks.resolveSource.mockResolvedValue({ url: null, publishedAt: null });
});

test.each([
  ["reddit.com", "reddit.com"],
  ["An article about the problem", ""],
  ["  WWW.Reddit.com  ", "www.reddit.com"],
  ["https://reddit.com/story", ""],
  ["reddit.com:443", ""],
  ["user@reddit.com", ""],
  ["127.0.0.1", ""],
  ["reddit..com", ""],
  ["-reddit.com", ""],
  ["vertexaisearch.cloud.google.com", ""],
  ["", ""],
])("unresolved source uses only hostname metadata: %s", async (title, expectedDomain) => {
  mocks.groundedSearch.mockResolvedValue({ model: "test", text: "Reported problem", groundingChunks: [{ uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/test", title }], groundingSupports: [{ text: "Reported problem", chunkIndices: [0] }] });
  const result = await createEvidence("workspace", "version");
  expect(result.items[0].source).toEqual({ title, domain: expectedDomain, url: null });
});


test("resolved publisher host takes precedence without changing original title", async () => {
  mocks.groundedSearch.mockResolvedValue({ model: "test", text: "Reported problem", groundingChunks: [{ uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/test", title: "Original article title" }], groundingSupports: [{ text: "Reported problem", chunkIndices: [0] }] });
  mocks.resolveSource.mockResolvedValue({ url: "https://publisher.org/article", publishedAt: null });
  const result = await createEvidence("workspace", "version");
  expect(result.items[0].source).toEqual({ title: "Original article title", domain: "publisher.org", url: "https://publisher.org/article" });
});


test("a successful redirect-service interstitial still does not name Google as publisher", async () => {
  mocks.groundedSearch.mockResolvedValue({ model: "test", text: "Reported problem", groundingChunks: [{ uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/test", title: "reddit.com" }], groundingSupports: [{ text: "Reported problem", chunkIndices: [0] }] });
  mocks.resolveSource.mockResolvedValue({ url: "https://vertexaisearch.cloud.google.com/interstitial", publishedAt: null });
  const result = await createEvidence("workspace", "version");
  expect(result.items[0].source.domain).toBe("reddit.com");
});


test("unresolved direct source retains its known hostname with a prose title", async () => {
  mocks.groundedSearch.mockResolvedValue({ model: "test", text: "Reported problem", groundingChunks: [{ uri: "https://publisher.org/article", title: "Original article title" }], groundingSupports: [{ text: "Reported problem", chunkIndices: [0] }] });
  const result = await createEvidence("workspace", "version");
  expect(result.items[0].source).toEqual({ title: "Original article title", domain: "publisher.org", url: null });
});
