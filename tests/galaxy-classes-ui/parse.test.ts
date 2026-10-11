import { describe, expect, it } from "vitest";
import { isProject, parseClasses, Prize, Project } from "@/lib/classes";

// The fast check must accept exactly what the zod schemas accept, for every field of a project and of a prize.
const ODD: unknown[] = [undefined, null, "", "s", "clear", "mixed", "placement", "other", 0, 1, 2, 3, 4, 1.5, -1, NaN, Infinity, true, {}, []];
const prize = { event: "E", text: "1st place", kind: "placement", place: 1, sponsor: null };
const project = { domain: "health", status: "clear", runner_up: null, prizes: [prize] };

describe("isProject", () => {
  it("matches zod on every odd value in every project field", () => {
    for (const key of Object.keys(project))
      for (const v of ODD) {
        const p = { ...project, [key]: v };
        expect(isProject(p), `${key}=${String(v)}`).toBe(Project.safeParse(p).success);
      }
    const { runner_up, ...noRunnerUp } = project;
    expect(runner_up).toBeNull();
    expect(isProject(noRunnerUp)).toBe(Project.safeParse(noRunnerUp).success);
  });
  it("matches zod on every odd value in every prize field", () => {
    for (const key of Object.keys(prize))
      for (const v of ODD) {
        const p = { ...project, prizes: [{ ...prize, [key]: v }] };
        expect(isProject(p), `prize.${key}=${String(v)}`).toBe(Project.safeParse(p).success);
        expect(Prize.safeParse({ ...prize, [key]: v }).success).toBe(Project.safeParse(p).success);
      }
  });
  it("refuses a file with one bad project, and still checks the head and the corpus", () => {
    const file = { corpus_version: "v1", domains: [{ id: "health", label: "Health" }], projects: { a: project, b: project } };
    expect(parseClasses(file, "v1").state).toBe("ready");
    expect(parseClasses({ ...file, projects: { a: project, b: { ...project, status: "unclear" } } }, "v1")).toEqual({ state: "missing", reason: "classes.json is invalid" });
    expect(parseClasses({ ...file, domains: [] }, "v1").state).toBe("missing");
    expect(parseClasses(file, "v2")).toEqual({ state: "missing", reason: "classes.json is for another corpus" });
  });
});
