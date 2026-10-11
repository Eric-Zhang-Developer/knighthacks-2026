import { beforeEach, expect, test, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const { execute, generate, getEvidence } = vi.hoisted(() => ({ execute: vi.fn(), generate: vi.fn(), getEvidence: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: () => ({ execute }) }));
vi.mock("@/lib/ai/generate", () => ({ generate }));
vi.mock("@/lib/evidence/service", () => ({ getEvidence }));
vi.mock("@/lib/search/embed", () => ({ embed: vi.fn() }));
import { propose } from "@/lib/revisions/service";

beforeEach(() => {
  vi.resetAllMocks();
  getEvidence.mockResolvedValue({ cards: [] });
  execute.mockResolvedValueOnce({ rows: [{ createdAt: "2026-10-10T00:00:00Z", title: "Meal planning",
    description: null, audience: null, problem: null, workflow: null, constraints: null }] });
  execute.mockResolvedValue({ rows: [] });
});

test("proposal reasons are inferred claims while persistence retains their original text", async () => {
  const reason = "Narrowing the audience makes it testable.";
  generate.mockResolvedValue({ suggestions: [{ field: "audience", change: "Hackathon teammates", reason }] });
  const { suggestions } = await propose("workspace", "version");
  expect(suggestions).toEqual([{ id: expect.any(String), field: "audience", change: "Hackathon teammates",
    reason: { text: reason, label: "inferred", sourceIds: [] } }]);
  const insert = new PgDialect().sqlToQuery(execute.mock.calls[1][0]);
  expect(insert.params).toContain(reason);
  expect(insert.params.some((value) => typeof value === "object" && value !== null)).toBe(false);
});

test("a proposal with no suggestions stays empty and writes no rows", async () => {
  generate.mockResolvedValue({ suggestions: [] });
  expect(await propose("workspace", "version")).toEqual({ suggestions: [] });
  expect(execute).toHaveBeenCalledTimes(1);
});
