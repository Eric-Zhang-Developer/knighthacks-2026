import { expect, it } from "vitest";
import { fromForm, galaxyState, hasText, toForm, type Version } from "@/components/idea/fields";

it("round-trips fields, sending blanks as null rather than inventing values", () => {
  const form = toForm({ title: "Meal planner", audience: null });
  expect(form.audience).toBe("");
  const fields = fromForm({ ...form, problem: "  ", workflow: " plan meals " });
  expect(fields).toEqual({ title: "Meal planner", description: null, audience: null, problem: null, workflow: "plan meals", constraints: null });
  expect(hasText(fields)).toBe(true);
  expect(hasText(fromForm(toForm({})))).toBe(false);
});

it("puts every saved idea in the galaxy, the latest active with its neighbors", () => {
  const v = (versionId: string, createdAt: string, neighborIds: string[]) =>
    ({ versionId, createdAt, neighborIds, x: 1, y: 2, z: 3 }) as Version;
  const state = galaxyState([v("old", "2026-10-10T10:00:00Z", ["a"]), v("new", "2026-10-10T11:00:00Z", ["b", "c"])]);
  expect(state.ideaStars.map((s) => s.versionId)).toEqual(["old", "new"]);
  expect(state.activeIdeaVersionId).toBe("new");
  expect(state.highlightedIds).toEqual(["b", "c"]);
  expect(galaxyState([])).toEqual({ ideaStars: [], activeIdeaVersionId: null, highlightedIds: [] });
});
