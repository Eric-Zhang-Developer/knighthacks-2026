// Shapes from challenge-api (lib/challenge/contract.ts) and lib/ai/claims.
export type Perspective = "user" | "judge" | "engineer";
export type Outcome = "revise" | "gather evidence" | "test" | "answered well";
export type Claim = { text: string; label: "supported" | "inferred" | "unverified"; sourceIds: string[] };
export type Round = { round: number; question: string; assumption: string; source: Claim; answer?: string; outcome?: Outcome };

export const MAX_ROUNDS = 3;

// What the panel offers next: answer the open question, ask the next one, or (after round 3) only a new session.
export function nextStep(rounds: Round[]): "start" | "answer" | "next" | "done" {
  const last = rounds[rounds.length - 1];
  if (!last) return "start";
  if (!last.outcome) return "answer";
  return rounds.length >= MAX_ROUNDS ? "done" : "next";
}

// The revision context names the challenge, so suggestions address the assumption that was questioned.
export const reviseContext = (r: Round) =>
  `Challenge question: ${r.question}\nAssumption: ${r.assumption}\nAnswer: ${r.answer ?? ""}`.slice(0, 4000);
