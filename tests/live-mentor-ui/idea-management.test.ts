import { describe, expect, it } from "vitest";
import type { Version } from "../../components/idea/fields";
import { afterDeletion, confirmsDeletion, readIdeaIntent, resolveIdea } from "../../components/mentor/idea-management";

const idea = (id: string, title: string): Version => ({ ideaId: id, versionId: `${id}-v1`, title, description: null, audience: null, problem: null, workflow: null, constraints: null, parentId: null, x: 0, y: 0, z: 0, neighborIds: [], corpusVersion: "fixture", createdAt: "2026-10-11T00:00:00Z" });
const ideas = [idea("a", "Study planner"), idea("b", "Quiet campus")];

describe("saved idea management", () => {
  it("uses explicit whole utterances and named workspace resolution", () => {
    expect(readIdeaIntent("Please add another idea.")).toEqual({ kind: "add" });
    expect(readIdeaIntent("List my saved ideas")).toEqual({ kind: "list" });
    expect(readIdeaIntent("Select saved idea Study planner")).toEqual({ kind: "select", title: "Study planner" });
    expect(readIdeaIntent("Delete saved idea Quiet campus")).toEqual({ kind: "delete", title: "Quiet campus" });
    expect(resolveIdea(ideas, "study PLANNER")).toEqual(ideas[0]);
    expect(resolveIdea(ideas, "planner")).toBeNull();
    expect(resolveIdea(ideas, "foreign-id")).toBeNull();
    expect(resolveIdea([...ideas, idea("c", "Study planner")], "Study planner")).toBeNull();
  });
  it.each(["yes", "confirm delete", "don't delete saved idea Quiet campus", 'He said "delete saved idea Quiet campus"', "if I say delete saved idea Quiet campus", "delete idea one"])("never treats ambiguous prose as destructive confirmation: %s", (text) => {
    expect(readIdeaIntent(text)).toBeNull();
  });
  it("keeps unrelated selection, selects a survivor, and supports the last deletion", () => {
    expect(afterDeletion(ideas, "a", "a")).toEqual({ remaining: [ideas[1]], selected: ideas[1] });
    expect(afterDeletion(ideas, "b", "a")).toEqual({ remaining: [ideas[0]], selected: ideas[0] });
    expect(afterDeletion([ideas[0]], "a", "a")).toEqual({ remaining: [], selected: null });
    expect(ideas).toHaveLength(2);
  });
  it("accepts only a successful receipt for the exact reviewed ID", () => {
    expect(confirmsDeletion({ ideaId: "a", deleted: true }, "a")).toBe(true);
    for (const receipt of [null, {}, { ideaId: "b", deleted: true }, { ideaId: "a", deleted: false }, { ideaId: "a", deleted: "true" }]) expect(confirmsDeletion(receipt, "a")).toBe(false);
  });
});
