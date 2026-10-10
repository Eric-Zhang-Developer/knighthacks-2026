import { beforeEach, expect, test, vi } from "vitest";
import { resultIds } from "@/lib/search/highlight";

vi.mock("next/dist/compiled/server-only", () => ({}));
const embed = vi.fn();
const neighbors = vi.fn();
const titleMatches = vi.fn();
vi.mock("@/lib/search/embed", () => ({ embed }));
vi.mock("@/lib/search/neighbors", () => ({ neighbors, titleMatches }));

const { GET } = await import("@/app/api/search/route");
const get = (qs: string) => GET(new Request(`http://x/api/search?${qs}`));
const hit = (id: string) => ({ id, title: id, tagline: null, event: null, year: null });

beforeEach(() => {
  vi.resetAllMocks();
  titleMatches.mockResolvedValue([hit("t1")]);
  neighbors.mockResolvedValue([{ ...hit("n1"), similarity: 0.9 }]);
  embed.mockResolvedValue([1, 0]);
});

test("q is required and capped at 500 characters", async () => {
  expect((await get("q=")).status).toBe(400);
  expect((await get(`q=${"a".repeat(501)}`)).status).toBe(400);
  expect((await get(`q=${"a".repeat(500)}`)).status).toBe(200);
});

test("meaning results come from the query's embedding, with filters passed through", async () => {
  const body = await (await get("q=braille&event=BloomKnights&year=2026")).json();
  expect(embed).toHaveBeenCalledWith("braille");
  expect(neighbors).toHaveBeenCalledWith([1, 0], { event: "BloomKnights", year: 2026 });
  expect(body).toEqual({ results: [{ ...hit("n1"), similarity: 0.9 }], textMatches: [hit("t1")], meaning: "ok" });
});

test("an embedding failure still answers with title matches", async () => {
  embed.mockRejectedValue(new Error("HF down"));
  const res = await get("q=braille");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ results: [], textMatches: [hit("t1")], meaning: "unavailable" });
  expect(neighbors).not.toHaveBeenCalled();
});

test("a database failure is a 503, not a crash", async () => {
  titleMatches.mockRejectedValue(new Error("db down"));
  expect((await get("q=braille")).status).toBe(503);
});

test("highlights list meaning results first, without duplicates", () => {
  expect(resultIds({ results: [hit("a"), hit("b")], textMatches: [hit("b"), hit("c")] })).toEqual(["a", "b", "c"]);
});
