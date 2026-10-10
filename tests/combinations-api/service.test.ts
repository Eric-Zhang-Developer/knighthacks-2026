import { beforeEach, expect, test, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const { execute, generate } = vi.hoisted(() => ({ execute: vi.fn(), generate: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: () => ({ execute }) }));
vi.mock("@/lib/ai/generate", () => ({ generate }));
import { createCombinations, getCombinations } from "@/lib/combinations/service";
const a = "a".repeat(40), b = "b".repeat(40);
const version = { title: "Idea", workflow: "Collect and choose", neighborIds: [a, b], corpusVersion: "corpus" };
const records = [a, b].map((id) => ({ id, title: `Project ${id}`, url: `https://example.test/${id}`, description: `Excerpt ${id}`, tagline: null }));
const candidate = { user: "A team", benefit: { text: "Could coordinate more easily", label: "inferred", sourceIds: [a, b] }, workflow: ["Collect requirements"], sourceIds: [a, b], claims: [] };
const saved = { versionId: "version", suggestions: [] };
const rows = (values: unknown[]) => ({ rows: values });
beforeEach(() => { vi.resetAllMocks(); generate.mockResolvedValue({ suggestions: [candidate] }); });
test("cached POST and GET require scoped database reads only, never corpus or generation", async () => {
  execute.mockResolvedValue(rows([{ data: saved }]));
  expect(await createCombinations("workspace", "version")).toEqual(saved); expect(await getCombinations("workspace", "version")).toEqual(saved);
  expect(generate).not.toHaveBeenCalled(); expect(execute).toHaveBeenCalledTimes(2);
  expect(new PgDialect().sqlToQuery(execute.mock.calls[0][0]).params).toEqual(["version", "workspace"]);
});
test("foreign version fails before source access or generation", async () => {
  execute.mockResolvedValue(rows([])); await expect(createCombinations("other", "version")).rejects.toMatchObject({ status: 404 });
  expect(execute).toHaveBeenCalledTimes(2); expect(generate).not.toHaveBeenCalled();
});
test("source lookup is bound to saved order and corpus version, then winner is read afresh", async () => {
  execute.mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([version])).mockResolvedValueOnce(rows([...records].reverse())).mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([{ data: saved }]));
  expect(await createCombinations("workspace", "version")).toEqual(saved);
  expect(new PgDialect().sqlToQuery(execute.mock.calls[2][0]).params).toEqual([JSON.stringify([a, b]), "corpus"]);
  const query = new PgDialect().sqlToQuery(execute.mock.calls[3][0]);
  expect(query.sql).toContain('on conflict ("version_id") do nothing');
  const persisted = JSON.parse(query.params[0] as string);
  expect(persisted.suggestions[0].sources.map((source: { projectId: string }) => source.projectId)).toEqual([a, b]);
  expect(generate.mock.calls[0][0].prompt.stubKey).toBe("combinations");
  expect(new PgDialect().sqlToQuery(execute.mock.calls[4][0]).params).toEqual(["version", "workspace"]);
});
test("missing or unsafe corpus records fail safely before model use", async () => {
  for (const bad of [[], [{ ...records[0], url: "javascript:alert(1)" }, records[1]]]) {
    execute.mockReset(); execute.mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([version])).mockResolvedValueOnce(rows(bad));
    await expect(createCombinations("workspace", "version")).rejects.toMatchObject({ status: 503 });
  }
  expect(generate).not.toHaveBeenCalled();
});
test("provider failure inserts nothing and does not expose provider exception", async () => {
  execute.mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([version])).mockResolvedValueOnce(rows(records)); generate.mockRejectedValue(new Error("private key"));
  await expect(createCombinations("workspace", "version")).rejects.toMatchObject({ status: 502, message: "Combination generation is temporarily unavailable. Please retry." }); expect(execute).toHaveBeenCalledTimes(3);
});
test("all-invalid output is persisted as empty, never padded with invented pairs", async () => {
  generate.mockResolvedValue({ suggestions: [null, {}] });
  execute.mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([version])).mockResolvedValueOnce(rows(records)).mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([{ data: saved }]));
  expect(await createCombinations("workspace", "version")).toEqual(saved);
  expect(JSON.parse(new PgDialect().sqlToQuery(execute.mock.calls[3][0]).params[0] as string)).toEqual(saved);
});
