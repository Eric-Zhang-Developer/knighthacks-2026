import { expect, test } from "vitest";
import { outputSchema, requestSchema, settle } from "@/lib/interview/contract";

const q = (field: string, question = `What is the ${field}?`) => ({ field, question, why: "It changes what gets built" }) as never;

test("done means no questions; no questions means done; one question per field, at most three", () => {
  expect(settle({ questions: [q("problem")], done: true })).toEqual({ questions: [], done: true });
  expect(settle({ questions: [], done: false })).toEqual({ questions: [], done: true });
  expect(settle({ questions: [q("problem"), q("problem", "Again?"), q("workflow")], done: false }))
    .toEqual({ questions: [q("problem"), q("workflow")], done: false });
});

test("requests carry interpreted fields and at most nine answers; output beyond three questions is trimmed, not rejected", () => {
  const fields = { title: null, description: "an app for students", audience: null, problem: null, workflow: null, constraints: null };
  const a = { question: "Who uses it?", field: "audience", answer: "First-year students" };
  expect(requestSchema.safeParse({ fields, answers: [] }).success).toBe(true);
  expect(requestSchema.safeParse({ fields, answers: Array(10).fill(a) }).success).toBe(false);
  expect(requestSchema.safeParse({ fields, answers: [{ ...a, field: "pricing" }] }).success).toBe(false);
  const four = { questions: ["audience", "problem", "workflow", "data"].map((f) => q(f)), done: false };
  expect(outputSchema.safeParse(four).success).toBe(true);
  expect(settle(outputSchema.parse(four)).questions.map((x) => x.field)).toEqual(["audience", "problem", "workflow"]);
  expect(outputSchema.safeParse({ ...four, questions: [...four.questions, ...four.questions] }).success).toBe(false);
});
