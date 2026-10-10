import { beforeEach, expect, test, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const { execute, generate } = vi.hoisted(() => ({ execute: vi.fn(), generate: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: () => ({ execute }) }));
vi.mock("@/lib/ai/generate", () => ({ generate }));
import { start, round, answer } from "@/lib/challenge/service";
const session = { id: "session", versionId: "version", perspective: "judge", round: 0, state: "idle", title: "Idea", neighborIds: ["real"], corpusVersion: "corpus" };
const output = { question: "Can this be tested?", assumption: "Users need it", source: { text: "actual excerpt", label: "supported", sourceIds: ["real"] }, test: null };
const rows = (values: unknown[]) => ({ rows: values });
beforeEach(() => { vi.resetAllMocks(); generate.mockResolvedValue(output); });
test("session creation is scoped and creates no version", async () => {
  execute.mockResolvedValueOnce(rows([{ id: "session" }]));
  expect(await start("workspace", "version", "judge")).toMatchObject({ versionId: "version", perspective: "judge" });
  const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
  expect(query.params).toContain("workspace"); expect(query.sql).not.toMatch(/insert into "idea_versions"/);
});
test("foreign sessions stop before reservation or generation", async () => {
  execute.mockResolvedValueOnce(rows([]));
  await expect(round("foreign", "session")).rejects.toMatchObject({ status: 404 });
  expect(execute).toHaveBeenCalledTimes(1); expect(generate).not.toHaveBeenCalled();
});
test("a failed reservation makes no question and caps/excludes concurrent slots", async () => {
  execute.mockResolvedValueOnce(rows([session])).mockResolvedValueOnce(rows([]));
  await expect(round("workspace", "session")).rejects.toMatchObject({ status: 409 });
  expect(generate).not.toHaveBeenCalled();
  const query = new PgDialect().sqlToQuery(execute.mock.calls[1][0]);
  expect(query.sql).toContain('"round_count" < 3'); expect(query.sql).toContain('"state" = \'idle\'');
});
test("valid question is finalized with the reservation token and returned through claim checks", async () => {
  execute.mockResolvedValueOnce(rows([session])).mockResolvedValueOnce(rows([{ round: 2 }])).mockResolvedValueOnce(rows([{ id: "real", description: "actual excerpt" }])).mockResolvedValueOnce(rows([{ round: 1, question: "Earlier question", answer: "Earlier answer", outcome: "test" }])).mockResolvedValueOnce(rows([{ round: 2 }]));
  expect(await round("workspace", "session")).toEqual({ round: 2, question: output.question, assumption: output.assumption, source: output.source });
  expect(generate.mock.calls[0][0].prompt.text).toContain("Earlier answer");
  expect(generate).toHaveBeenCalledTimes(1); expect(generate.mock.calls[0][0].prompt.stubKey).toBe("challenge-round-2");
  const reserve = new PgDialect().sqlToQuery(execute.mock.calls[1][0]), finish = new PgDialect().sqlToQuery(execute.mock.calls[4][0]);
  expect(finish.params).toContain(reserve.params[0]); expect(finish.sql).toContain('"operation_id" =');
});
test("invalid generation consumes its slot and releases it as failed without outer retries", async () => {
  execute.mockResolvedValueOnce(rows([session])).mockResolvedValueOnce(rows([{ round: 1 }])).mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([{ round: 1 }]));
  generate.mockRejectedValue(new Error("raw provider secret"));
  await expect(round("workspace", "session")).rejects.toMatchObject({ status: 502 });
  expect(generate).toHaveBeenCalledTimes(1);
  expect(new PgDialect().sqlToQuery(execute.mock.calls[4][0]).params).toContain("failed");
});
test("stale finalization cannot succeed or unlock another operation", async () => {
  execute.mockResolvedValueOnce(rows([session])).mockResolvedValueOnce(rows([{ round: 1 }])).mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([]));
  await expect(round("workspace", "session")).rejects.toMatchObject({ status: 409 });
  const reserve = new PgDialect().sqlToQuery(execute.mock.calls[1][0]);
  for (const index of [4, 5]) expect(new PgDialect().sqlToQuery(execute.mock.calls[index][0]).params).toContain(reserve.params[0]);
});
test("answer assessment uses stored question plus real answer and excludes repeats", async () => {
  execute.mockResolvedValueOnce(rows([session])).mockResolvedValueOnce(rows([{ round: 2, ...output }])).mockResolvedValueOnce(rows([{ round: 2 }]));
  generate.mockResolvedValue({ outcome: "gather evidence" });
  expect(await answer("workspace", "session", "I interviewed users")).toEqual({ outcome: "gather evidence" });
  const prompt = generate.mock.calls[0][0].prompt;
  expect(prompt.stubKey).toBe("challenge-answer-2"); expect(prompt.text).toContain("I interviewed users"); expect(prompt.text).toContain(output.question);
  execute.mockResolvedValueOnce(rows([session])).mockResolvedValueOnce(rows([]));
  await expect(answer("workspace", "session", "repeat")).rejects.toMatchObject({ status: 409 });
  expect(generate).toHaveBeenCalledTimes(1);
});
