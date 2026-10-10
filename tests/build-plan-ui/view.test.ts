import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import PlanView, { type PlanViewProps } from "@/components/plan/PlanView";
import { hourLabel, validInput, type Plan, type View } from "@/components/plan/plan";

// The panel isn't mounted until experience-shell places it (#299), so every view state is rendered here directly.
const s = (label: "supported" | "inferred" | "unverified", sourceIds: string[] = []) => ({ label, sourceIds });
const plan = (id: string, hoursLeft = 10): Plan => ({ id, versionId: "v", createdAt: "2026-10-10T21:00:00Z", hoursLeft, teamSize: 2, skills: [],
  tour: [{ text: "Type a dietary limit and watch the shared meal list update", ...s("supported", ["p1"]) }],
  cut: [{ text: "Restaurant ordering", ...s("inferred") }],
  timeline: [{ hour: 1.5, goal: "Constraints form saves", ...s("inferred") }, { hour: 9, goal: "Code freeze", ...s("inferred") }],
  risks: [{ risk: "No menu data", countermeasure: "Use three hand-entered menus", ...s("unverified") }] });
const render = (view: View, extra: Partial<PlanViewProps> = {}) => renderToStaticMarkup(createElement(PlanView, {
  view, previous: [], hours: 10, team: 2, onHours: () => {}, onTeam: () => {}, onGenerate: () => {}, ...extra })).replaceAll("<!-- -->", "");

test("a generated plan: tour, cut list, timeline and risks, each line with a worded badge", () => {
  const html = render({ kind: "ready", plan: plan("a") });
  for (const name of ["Demo tour", "Cut list", "Timeline", "Risks"]) expect(html).toContain(`aria-label="${name}"`);
  expect(html).toMatch(/data-label="supported">.*supported<\/span> Type a dietary limit/);
  expect(html).toMatch(/data-label="inferred">.*inferred<\/span> Restaurant ordering/);
  expect(html).toContain("+1.5 h");
  expect(html).toContain("+9 h");
  expect(html).toMatch(/data-label="unverified">.*unverified<\/span> No menu data/);
  expect(html).toContain("Countermeasure: Use three hand-entered menus");
  expect(html).toContain(">Regenerate</button>");
  expect(html).not.toMatch(/total|odds|chance of winning/i);
});

test("regenerating keeps the earlier plan readable below the new one", () => {
  const html = render({ kind: "ready", plan: plan("new", 8) }, { previous: [plan("old", 10)] });
  expect(html).toContain("For 8 hours and 2 people.");
  expect(html).toContain("<summary>Earlier plan: 10 hours, 2 people</summary>");
  expect(html.split('aria-label="Timeline"').length - 1).toBe(2);
});

test("loading, empty, generating and failed use PanelState; failure offers retry", () => {
  expect(render({ kind: "loading" })).toContain("Loading your plan…");
  const empty = render({ kind: "empty" });
  expect(empty).toContain("No plan yet.");
  expect(empty).toMatch(/<button type="submit"[^>]*>Plan this idea<\/button>/);
  expect(empty).not.toMatch(/<button type="submit"[^>]*disabled/);
  expect(render({ kind: "generating" })).toMatch(/<button type="submit"[^>]*disabled=""[^>]*>Plan this idea/);
  const failed = render({ kind: "failed", error: "Build planning is temporarily unavailable." });
  expect(failed).toContain('role="alert"');
  expect(failed).toContain("Couldn&#x27;t plan this idea: Build planning is temporarily unavailable.");
  expect(failed).toContain(">Retry</button>");
});

test("hours and team size are prefilled 10 and 2, labelled, and bounded like the API", () => {
  const html = render({ kind: "empty" });
  expect(html).toMatch(/<span>Hours left<\/span><input type="number" min="2" max="72" step="0.5" value="10"/);
  expect(html).toMatch(/<span>Team size<\/span><input type="number" min="1" max="20" step="1" value="2"/);
  expect(validInput(10, 2)).toBe(true);
  expect(validInput(1, 2)).toBe(false);
  expect(validInput(10, 2.5)).toBe(false);
  expect(validInput(Number.NaN, 2)).toBe(false);
  expect(render({ kind: "empty" }, { hours: 1 })).toMatch(/<button type="submit"[^>]*disabled/);
  expect(hourLabel(3)).toBe("+3 h");
});
