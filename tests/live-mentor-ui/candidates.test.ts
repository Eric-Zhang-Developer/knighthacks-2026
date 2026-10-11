import { describe, expect, it } from "vitest";
import { addCandidate } from "../../components/mentor/candidates";
import type { Fields } from "../../components/idea/fields";

const idea: Fields = { title: "Study planner", audience: "Students", problem: "Scheduling study time", workflow: null, constraints: null, description: null };

describe("candidate ideas", () => {
  it("keeps three distinct alternatives without saving any of them", () => {
    const candidates = [idea, { ...idea, title: "Study partner" }, { ...idea, title: "Practice coach" }].reduce((items, fields, index) => addCandidate(items, fields, String(index)), addCandidate([], idea, "first"));
    expect(candidates).toHaveLength(3);
    expect(candidates.every((candidate) => candidate.versionId === undefined)).toBe(true);
  });
  it("deduplicates provider redelivery and retains the stable save key", () => {
    const candidates = addCandidate([], idea, "original");
    expect(addCandidate(candidates, { ...idea }, "retry")).toBe(candidates);
    expect(candidates[0].saveKey).toBe("original");
  });
  it("does not collapse similarly named directions or evict older ones", () => {
    const candidates = Array.from({ length: 4 }, (_, index) => ({ ...idea, workflow: `Alternative ${index}` })).reduce((items, fields, index) => addCandidate(items, fields, String(index)), addCandidate([], idea, "first"));
    expect(candidates).toHaveLength(5);
    expect(candidates[0].id).toBe("first");
    expect(candidates[0].fields.workflow).toBeNull();
  });
});
