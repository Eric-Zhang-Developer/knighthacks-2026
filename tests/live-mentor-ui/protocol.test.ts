import { describe, expect, it } from "vitest";
import { canonical, readFields, toolIdentity } from "../../components/mentor/protocol";

describe("mentor client contract", () => {
  it("preserves unknown fields instead of inventing answers", () => {
    const fields = { title: "A draft", description: null, audience: null, problem: null, workflow: null, constraints: null };
    expect(readFields(fields)).toEqual(fields);
  });
  it("rejects malformed and empty proposals", () => {
    expect(() => readFields({ title: "missing fields" })).toThrow();
    expect(() => readFields({ title: null, description: null, audience: null, problem: null, workflow: null, constraints: null })).toThrow();
  });
  it("uses sorted nested keys and retains array order", () => {
    expect(canonical({ z: [2, 1], a: { c: 2, b: 1 } })).toBe('{"a":{"b":1,"c":2},"z":[2,1]}');
  });
  it("makes retries stable but isolates sessions and turns", async () => {
    const one = await toolIdentity("session-a", 1, "find_projects", { query: "idea" });
    expect(one).toMatch(/^[a-f0-9]{64}$/);
    expect(await toolIdentity("session-a", 1, "find_projects", { query: "idea" })).toBe(one);
    expect(await toolIdentity("session-a", 2, "find_projects", { query: "idea" })).not.toBe(one);
    expect(await toolIdentity("session-b", 1, "find_projects", { query: "idea" })).not.toBe(one);
  });
});
