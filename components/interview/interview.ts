// Contract from specs/features/idea-interview-api/spec.md (POST /api/ideas/questions).
export const QUESTION_FIELDS = ["audience", "problem", "workflow", "constraints", "data", "demo"] as const;
export type QuestionField = (typeof QUESTION_FIELDS)[number];
export type Question = { field: QuestionField; question: string; why: string };
export type Answer = { question: string; field: QuestionField; answer: string };
export type Round = { questions: Question[]; done: boolean };

// Answered questions only, trimmed; a blank answer is no answer.
export const answered = (questions: Question[], typed: string[]): Answer[] =>
  questions.flatMap((q, i) => (typed[i]?.trim() ? [{ question: q.question, field: q.field, answer: typed[i].trim() }] : []));

// Answers join the idea text as plain Q/A lines, so re-interpreting reads them like anything else the user wrote.
export const withAnswers = (text: string, answers: Answer[]) =>
  [text.trim(), ...answers.map((a) => `${a.question} ${a.answer}`)].filter(Boolean).join("\n");

// A spoken utterance committed to the draft while answering: the new text past the draft as it was.
export function spokenDelta(before: string, after: string): string | null {
  if (after === before || !after.startsWith(before.trimEnd())) return null;
  return after.slice(before.trimEnd().length).trim() || null;
}
