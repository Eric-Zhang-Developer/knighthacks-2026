import { expect, test } from "vitest";
import { answered, spokenDelta, withAnswers, type Question } from "@/components/interview/interview";

const qs: Question[] = [
  { field: "problem", question: "What goes wrong today?", why: "Sets the problem." },
  { field: "workflow", question: "What does the user do first?", why: "Shapes the workflow." },
];

test("only non-blank answers count, trimmed, with their question and field", () => {
  expect(answered(qs, ["  Meals get wasted ", "   "])).toEqual([{ question: "What goes wrong today?", field: "problem", answer: "Meals get wasted" }]);
  expect(answered(qs, [])).toEqual([]);
});

test("answers join the idea text as question-answer lines", () => {
  const a = answered(qs, ["Meals get wasted", "They list allergies"]);
  expect(withAnswers(" An app for students ", a)).toBe("An app for students\nWhat goes wrong today? Meals get wasted\nWhat does the user do first? They list allergies");
  expect(withAnswers("Just text", [])).toBe("Just text");
});

test("a spoken utterance is the text voice added past the draft, nothing otherwise", () => {
  expect(spokenDelta("An app", "An app for students")).toBe("for students");
  expect(spokenDelta("", "Teams of four")).toBe("Teams of four");
  expect(spokenDelta("An app ", "An app teams")).toBe("teams");
  expect(spokenDelta("An app", "An app")).toBeNull();
  expect(spokenDelta("An app", "A different text")).toBeNull(); // typed over, not appended
});
