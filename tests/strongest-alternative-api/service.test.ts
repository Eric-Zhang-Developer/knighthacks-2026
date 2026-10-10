import { beforeEach, expect, test, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { z } from "zod";
const { execute, generate } = vi.hoisted(() => ({ execute: vi.fn(), generate: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: () => ({ execute }) }));
vi.mock("@/lib/ai/generate", () => ({ generate }));
import { createAlternative, getAlternative } from "@/lib/alternative/service";
import { comparisonSchema } from "@/lib/alternative/contract";
const projectId = "a".repeat(40), other = "b".repeat(40);
const version = { workflow: "Collect dietary requirements then choose a shared meal", problem: "Meal coordination", neighborIds: [projectId, other], corpusVersion: "corpus" };
const project = { title: "Real stored project", url: "https://example.test/project", description: "Stored excerpt describing the project", tagline: null };
const output = { points: [{ step: "Collect dietary requirements", claim: { text: "Stored excerpt", label: "supported", sourceIds: [projectId] } }, { step: "choose a shared meal", claim: { text: "Invented comparison", label: "supported", sourceIds: [projectId, other] } }] };
const saved = { versionId: "version", projectId, title: project.title, url: project.url, points: [], missingWorkflow: false };
const rows = (values: unknown[]) => ({ rows: values });
beforeEach(() => { vi.resetAllMocks(); generate.mockResolvedValue(output); });
test("schema accepts repeated real steps, rejects invented steps, and is JSON convertible", () => {
  const schema = comparisonSchema(version.workflow);
  expect(z.toJSONSchema(schema)).toHaveProperty("properties.points");
  expect(schema.safeParse(output).success).toBe(true);
  expect(schema.safeParse({ points: [output.points[0], output.points[0]] }).success).toBe(true);
  expect(schema.safeParse({ points: [output.points[0], { ...output.points[1], step: "Invented feature" }] }).success).toBe(false);
  expect(schema.safeParse({ points: [output.points[0]] }).success).toBe(false);
});
test("creation selects saved top neighbor and grounds every point before atomic immutable insert", async () => {
  execute.mockResolvedValueOnce(rows([version])).mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([project])).mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([{ data: saved }]));
  expect(await createAlternative("workspace", "version")).toEqual(saved);
  expect(generate.mock.calls[0][0].prompt.stubKey).toBe(`alternative-${projectId}`);
  expect(new PgDialect().sqlToQuery(execute.mock.calls[2][0]).params).toEqual([projectId, "corpus"]);
  const query = new PgDialect().sqlToQuery(execute.mock.calls[3][0]);
  const persisted = JSON.parse(query.params[0] as string);
  expect(persisted.points[0].claim.label).toBe("supported");
  expect(persisted.points[1].claim).toMatchObject({ label: "unverified", sourceIds: [projectId] });
  expect(query.sql).not.toMatch(/\bupdate\b/i);
});
test("cached POST and GET return stored data without generation or corpus lookup", async () => {
  execute.mockResolvedValueOnce(rows([version])).mockResolvedValueOnce(rows([{ data: saved }]));
  expect(await createAlternative("workspace", "version")).toEqual(saved);
  expect(execute).toHaveBeenCalledTimes(2); expect(generate).not.toHaveBeenCalled();
  execute.mockResolvedValueOnce(rows([{ data: saved }]));
  expect(await getAlternative("workspace", "version")).toEqual(saved);
  const query = new PgDialect().sqlToQuery(execute.mock.calls[2][0]);
  expect(query.params).toEqual(["version", "workspace"]);
});
test.each([null, "", "  "])("missing workflow %s persists real metadata without AI", async (workflow) => {
  execute.mockResolvedValueOnce(rows([{ ...version, workflow }])).mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([project])).mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([{ data: { ...saved, missingWorkflow: true } }]));
  await createAlternative("workspace", "version");
  expect(generate).not.toHaveBeenCalled();
  const data = JSON.parse(new PgDialect().sqlToQuery(execute.mock.calls[3][0]).params[0] as string);
  expect(data).toMatchObject({ projectId, title: project.title, url: project.url, missingWorkflow: true, points: [] });
});
test("foreign version stops before cache access or generation", async () => {
  execute.mockResolvedValueOnce(rows([]));
  await expect(createAlternative("other", "version")).rejects.toMatchObject({ status: 404 });
  expect(execute).toHaveBeenCalledTimes(1); expect(generate).not.toHaveBeenCalled();
});
test("missing source or failed generation never inserts a result", async () => {
  execute.mockResolvedValueOnce(rows([version])).mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([]));
  await expect(createAlternative("workspace", "version")).rejects.toMatchObject({ status: 503 });
  expect(generate).not.toHaveBeenCalled();
  execute.mockReset(); execute.mockResolvedValueOnce(rows([version])).mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([project]));
  generate.mockRejectedValueOnce(new Error("private provider failure"));
  await expect(createAlternative("workspace", "version")).rejects.toMatchObject({ status: 502 });
  expect(execute).toHaveBeenCalledTimes(3);
});
test("concurrent loser returns earlier persisted winner from fresh scoped query", async () => {
  const winner = { ...saved, title: "Earlier source snapshot" };
  execute.mockResolvedValueOnce(rows([version])).mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([project])).mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([{ data: winner }]));
  expect(await createAlternative("workspace", "version")).toEqual(winner);
  expect(new PgDialect().sqlToQuery(execute.mock.calls[4][0]).params).toEqual(["version", "workspace"]);
});
