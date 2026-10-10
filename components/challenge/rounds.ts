// Shapes from challenge-api (lib/challenge/contract.ts) and lib/ai/claims.
export type Perspective = "user" | "judge" | "engineer";
export type Outcome = "revise" | "gather evidence" | "test" | "answered well";
export type Claim = { text: string; label: "supported" | "inferred" | "unverified"; sourceIds: string[] };
// A stored round can lack its question and source (it never finished); `unfinished` marks one the server gave up on.
export type Round = { round: number; question: string | null; assumption: string | null; source: Claim | null; answer?: string;
  outcome?: Outcome; unfinished?: boolean };
export type SessionState = "idle" | "generating" | "awaiting" | "answering";
// One version's latest session, as GET /api/workspace/state lists it (lib/workspace/state.ts).
export type StoredSession = { versionId: string; sessionId: string; perspective: Perspective; state: SessionState;
  rounds: { round: number; status: string; question: string | null; assumption: string | null; source: Claim | null;
    answer: string | null; outcome: string | null }[] };

export const fromStored = (s: StoredSession): Round[] =>
  s.rounds.map((r) => ({ round: r.round, question: r.question, assumption: r.assumption, source: r.source,
    ...(r.answer ? { answer: r.answer } : {}), ...(r.outcome ? { outcome: r.outcome as Outcome } : {}),
    ...(r.status === "failed" || !r.source ? { unfinished: true } : {}) }));

export const MAX_ROUNDS = 3;

// What the panel offers next: answer the open question, ask the next one, or (after round 3) only a new session. A
// session the server still marks busy is "stuck" until it's read again or skipped.
export function nextStep(rounds: Round[], state: SessionState = "idle"): "start" | "answer" | "next" | "done" | "stuck" {
  const last = rounds[rounds.length - 1];
  if (!last) return "start";
  if (state === "generating" || state === "answering") return "stuck";
  if (!last.outcome && !last.unfinished) return "answer";
  return rounds.length >= MAX_ROUNDS ? "done" : "next";
}

// The revision context names the challenge, so suggestions address the assumption that was questioned.
export const reviseContext = (r: Round) =>
  `Challenge question: ${r.question}\nAssumption: ${r.assumption}\nAnswer: ${r.answer ?? ""}`.slice(0, 4000);
