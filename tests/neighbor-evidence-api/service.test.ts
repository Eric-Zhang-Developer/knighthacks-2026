import { beforeEach, expect, test, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const { execute, generate } = vi.hoisted(() => ({ execute: vi.fn(), generate: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: () => ({ execute }) }));
vi.mock("@/lib/ai/generate", () => ({ generate }));
import { createEvidence, getEvidence } from "@/lib/evidence/service";
import { groundClaims } from "@/lib/evidence/contract";
const ids = [1, 2, 3, 4, 5].map((i) => String(i).repeat(40));
const version = { neighborIds: ids, corpusVersion: "corpus", title: "Idea", description: null, audience: null, problem: null, workflow: null, constraints: null };
const records = ids.map((id) => ({ id, url: "https://example.test/project", title: "Stored title", description: "Actual excerpt from the stored record.", tagline: "Stored tagline", corpusVersion: "corpus" }));
const claim = { text: "Actual excerpt", label: "supported" as const, sourceIds: [ids[0]] };
const card = (id: string) => ({ projectId: id, url: records[0].url, title: records[0].title, excerpt: records[0].description, overlaps: [], differences: [], uncertainty: { text: "Unknown", label: "unverified", sourceIds: [] } });
const result = (rows: unknown[]) => ({ rows });
beforeEach(() => { vi.resetAllMocks(); generate.mockResolvedValue({ overlaps: [claim], differences: [], uncertainty: { text: "Unknown", label: "unverified", sourceIds: [] } }); });
test("supported claims require exact excerpt quotes, and all foreign citations are removed", () => {
  const input = [claim, { ...claim, text: "Invented fact" }, { ...claim, sourceIds: [ids[0], "foreign"] }, { ...claim, label: "inferred" as const, sourceIds: ["foreign"] }, { ...claim, sourceIds: [] }];
  const output = groundClaims(input, ids[0], records[0].description);
  expect(output.map((c) => c.label)).toEqual(["supported", "unverified", "unverified", "unverified", "unverified"]);
  expect(output.map((c) => c.sourceIds)).toEqual([[ids[0]], [ids[0]], [ids[0]], [], []]);
  expect(input[2].sourceIds).toContain("foreign");
});
test("initial request generates top three and atomically stores a quoted source snapshot", async () => {
  execute.mockResolvedValueOnce(result([version])).mockResolvedValueOnce(result([])).mockResolvedValueOnce(result(records.slice(0, 3))).mockResolvedValueOnce(result([])).mockResolvedValueOnce(result(ids.slice(0, 3).map(card)));
  expect((await createEvidence("workspace", "version", false)).cards.map((c) => c.projectId)).toEqual(ids.slice(0, 3));
  expect(generate).toHaveBeenCalledTimes(3);
  expect(generate.mock.calls.map(([arg]) => arg.prompt.stubKey)).toEqual(ids.slice(0, 3).map((id) => `evidence-${id}`));
  const query = new PgDialect().sqlToQuery(execute.mock.calls[3][0]);
  expect(query.sql).toContain("jsonb_to_recordset"); expect(query.sql).toContain('order by c."projectId" on conflict (version_id, project_id) do nothing');
  expect(query.sql).not.toMatch(/\bupdate\b/i);
  const saved = JSON.parse(query.params[1] as string);
  expect(saved[0].excerpt).toBe(records[0].description);
  expect(saved[1].overlaps[0]).toMatchObject({ label: "unverified", sourceIds: [] });
});
test("completed repeat and GET return stored cards without source lookup or AI", async () => {
  execute.mockResolvedValueOnce(result([version])).mockResolvedValueOnce(result(ids.slice(0, 3).reverse().map(card)));
  expect((await createEvidence("workspace", "version", false)).cards.map((c) => c.projectId)).toEqual(ids.slice(0, 3));
  expect(execute).toHaveBeenCalledTimes(2); expect(generate).not.toHaveBeenCalled();
  execute.mockResolvedValueOnce(result([version])).mockResolvedValueOnce(result(ids.slice(0, 3).map(card)));
  expect((await getEvidence("workspace", "version")).cards).toHaveLength(3);
  expect(generate).not.toHaveBeenCalled();
});
test("explicit remaining request generates only unstored neighbors", async () => {
  execute.mockResolvedValueOnce(result([version])).mockResolvedValueOnce(result(ids.slice(0, 3).map(card))).mockResolvedValueOnce(result(records.slice(3))).mockResolvedValueOnce(result([])).mockResolvedValueOnce(result(ids.map(card)));
  expect((await createEvidence("workspace", "version", true)).cards).toHaveLength(5);
  expect(generate.mock.calls.map(([arg]) => arg.prompt.stubKey)).toEqual(ids.slice(3).map((id) => `evidence-${id}`));
});
test.each([
  { description: "", tagline: "Stored tagline", expected: "Stored tagline" },
  { description: " ", tagline: null, expected: "Stored title" },
  { description: "x".repeat(6001), tagline: null, expected: "x".repeat(6000) },
])("excerpt uses actual bounded source with fallback (%#)", async ({ description, tagline, expected }) => {
  execute.mockResolvedValueOnce(result([{ ...version, neighborIds: [ids[0]] }])).mockResolvedValueOnce(result([])).mockResolvedValueOnce(result([{ ...records[0], description, tagline }])).mockResolvedValueOnce(result([])).mockResolvedValueOnce(result([card(ids[0])]));
  await createEvidence("workspace", "version", false);
  const query = new PgDialect().sqlToQuery(execute.mock.calls[3][0]);
  expect(JSON.parse(query.params[1] as string)[0].excerpt).toBe(expected);
});
test("foreign or missing version fails before source, card or AI access", async () => {
  execute.mockResolvedValueOnce(result([]));
  await expect(createEvidence("workspace", "version", false)).rejects.toMatchObject({ status: 404 });
  expect(execute).toHaveBeenCalledTimes(1); expect(generate).not.toHaveBeenCalled();
  const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
  expect(query.params).toEqual(["version", "workspace"]); expect(query.sql).toContain("i.workspace_id =");
});
test("an older saved corpus version uses the current stable source id", async () => {
  execute.mockResolvedValueOnce(result([version])).mockResolvedValueOnce(result([])).mockResolvedValueOnce(result(records.map((r) => ({ ...r, corpusVersion: "new" }))));
  execute.mockResolvedValueOnce(result([])).mockResolvedValueOnce(result(ids.slice(0, 3).map(card)));
  expect((await createEvidence("workspace", "version", false)).cards).toHaveLength(3);
  expect(generate).toHaveBeenCalledTimes(3);
});
test("an older saved corpus still fails when a neighbor id is no longer available", async () => {
  execute.mockResolvedValueOnce(result([version])).mockResolvedValueOnce(result([])).mockResolvedValueOnce(result(records.slice(0, 2)));
  await expect(createEvidence("workspace", "version", false)).rejects.toMatchObject({ status: 503 });
  expect(generate).not.toHaveBeenCalled();
  expect(execute).toHaveBeenCalledTimes(3);
});
test("provider failure causes zero batch writes", async () => {
  execute.mockReset();
  execute.mockResolvedValueOnce(result([version])).mockResolvedValueOnce(result([])).mockResolvedValueOnce(result(records));
  generate.mockResolvedValueOnce({ overlaps: [], differences: [], uncertainty: { text: "Unknown", label: "unverified", sourceIds: [] } }).mockRejectedValueOnce(new Error("provider secret"));
  await expect(createEvidence("workspace", "version", false)).rejects.toMatchObject({ status: 502 });
  expect(execute).toHaveBeenCalledTimes(3);
});
test("database insertion failure is not reported as partial success", async () => {
  execute.mockResolvedValueOnce(result([version])).mockResolvedValueOnce(result([])).mockResolvedValueOnce(result(records)).mockRejectedValueOnce(new Error("database failure"));
  await expect(createEvidence("workspace", "version", false)).rejects.toThrow("database failure");
  expect(execute).toHaveBeenCalledTimes(4);
});

test("conflicting insert returns the persisted winner, not this request's generated candidate", async () => {
  const winner = { ...card(ids[0]), title: "Earlier stored snapshot" };
  execute.mockResolvedValueOnce(result([{ ...version, neighborIds: [ids[0]] }])).mockResolvedValueOnce(result([])).mockResolvedValueOnce(result([records[0]])).mockResolvedValueOnce(result([])).mockResolvedValueOnce(result([winner]));
  expect((await createEvidence("workspace", "version", false)).cards).toEqual([winner]);
  const query = new PgDialect().sqlToQuery(execute.mock.calls[4][0]);
  expect(query.sql).toContain("i.workspace_id ="); expect(query.params).toEqual(["version", "workspace"]);
});
