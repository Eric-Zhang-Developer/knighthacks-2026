import { describe, expect, it } from "vitest";
import { mergeDraft } from "../../components/mentor/autofill";
import { toForm, type FieldName, type Fields } from "../../components/idea/fields";

const proposal: Fields = { title: "Study planner", description: null, audience: "Students", problem: "Scheduling study time", workflow: "  ", constraints: null };

describe("the conversation fills the Idea step", () => {
  it("fills an empty form from the proposal, leaving unknown fields blank", () => {
    expect(mergeDraft(toForm({}), proposal, new Set())).toEqual({ title: "Study planner", description: "", audience: "Students", problem: "Scheduling study time", workflow: "", constraints: "" });
  });
  it("never overwrites a field the person typed, and never wipes one the mentor left blank", () => {
    const form = toForm({ title: "Old title", audience: "Night-shift nurses", workflow: "Typed workflow" });
    const merged = mergeDraft(form, proposal, new Set<FieldName>(["audience"]));
    expect(merged.title).toBe("Study planner");
    expect(merged.audience).toBe("Night-shift nurses");
    expect(merged.workflow).toBe("Typed workflow");
  });
});
