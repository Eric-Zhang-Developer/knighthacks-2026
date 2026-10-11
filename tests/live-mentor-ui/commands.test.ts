import { describe, expect, it } from "vitest";
import { confirmedCandidate, readCommand, type PendingSave } from "../../components/mentor/commands";
import { addCandidate } from "../../components/mentor/candidates";

describe("explicit conversational controls", () => {
  it("recognizes navigation and indexed candidate selection", () => {
    expect(readCommand("Please show the map.")).toEqual({ kind: "navigate", destination: "explore" });
    expect(readCommand("Proceed with idea two")).toEqual({ kind: "prepare-save", index: 1 });
    expect(readCommand("Confirm save idea 2")).toEqual({ kind: "confirm-save", index: 1 });
    expect(readCommand("End the call")).toEqual({ kind: "end" });
  });
  it.each(["yes", "that's a good idea", "don't save idea two", 'He said "save idea two"', "if I say save idea two", "save idea two and share it", "confirm save idea zero"])("does not treat ordinary or ambiguous prose as a command: %s", (text) => {
    expect(readCommand(text)).toBeNull();
  });
  const candidates = addCandidate([], { title: "Study planner", description: null, audience: "Students", problem: null, workflow: null, constraints: null }, "candidate-1");
  const pending: PendingSave = { candidate: structuredClone(candidates[0]), index: 0, expiresAt: 60_000 };
  it("requires a fresh exact candidate confirmation, not only a matching utterance", () => {
    expect(confirmedCandidate(null, candidates, 0, 100)).toBeNull();
    expect(confirmedCandidate(pending, candidates, 1, 100)).toBeNull();
    expect(confirmedCandidate(pending, candidates, 0, 60_000)).toBeNull();
    expect(confirmedCandidate(pending, candidates, 0, 100)).toEqual(pending.candidate);
  });
  it("invalidates edited and already saved proposals", () => {
    expect(confirmedCandidate(pending, [{ ...candidates[0], saveKey: "edited" }], 0, 100)).toBeNull();
    expect(confirmedCandidate(pending, [{ ...candidates[0], fields: { ...candidates[0].fields, title: "Changed" } }], 0, 100)).toBeNull();
    expect(confirmedCandidate(pending, [{ ...candidates[0], versionId: "saved" }], 0, 100)).toBeNull();
  });
});
