import { expect, test } from "vitest";
import { draftSchema, patchSchema, startSchema } from "@/lib/experiments/contract";

test("a draft needs all three nonblank parts", () => {
  expect(draftSchema.safeParse({ hypothesis: "h", procedure: "p", observable: "o" }).success).toBe(true);
  expect(draftSchema.safeParse({ hypothesis: "h", procedure: " ", observable: "o" }).success).toBe(false);
  expect(draftSchema.safeParse({ hypothesis: "h", procedure: "p" }).success).toBe(false);
});

test("a patch edits parts or records a result, never both, never blank", () => {
  expect(patchSchema.safeParse({ procedure: "new steps" }).success).toBe(true);
  expect(patchSchema.safeParse({ result: "refuted", note: "slow" }).success).toBe(true);
  expect(patchSchema.safeParse({ result: "inconclusive" }).success).toBe(true);
  expect(patchSchema.safeParse({}).success).toBe(false);
  expect(patchSchema.safeParse({ observable: "" }).success).toBe(false);
  expect(patchSchema.safeParse({ result: "maybe" }).success).toBe(false);
  expect(patchSchema.safeParse({ result: "refuted", observable: "x" }).success).toBe(false);
});

test("start takes a session UUID and a round from 1 to 3", () => {
  const sessionId = "5b1f7a4e-0b5e-4c56-9d8e-2a8f3c1d9e70";
  expect(startSchema.safeParse({ sessionId, round: 1 }).success).toBe(true);
  expect(startSchema.safeParse({ sessionId, round: 4 }).success).toBe(false);
  expect(startSchema.safeParse({ sessionId: "nope", round: 1 }).success).toBe(false);
});
