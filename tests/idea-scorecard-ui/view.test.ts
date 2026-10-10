import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import ScorecardView from "@/components/scorecard/ScorecardView";
import type { Criterion, Scorecard, View } from "@/components/scorecard/scorecard";

// Not mounted until experience-shell places it (#299), so every view state is rendered here directly.
const pt = (text: string, sourceIds: string[] = [], label: "supported" | "inferred" = sourceIds.length ? "supported" : "inferred") => ({ text, label, sourceIds });
const c = (criterion: string, score: number | null, extra: Partial<Criterion> = {}): Criterion => ({ criterion, score,
  for: [pt(`${criterion} strength`, ["p1"])], against: [pt(`${criterion} weakness`)], label: "inferred", note: score === null ? "evidence is insufficient" : null, ...extra });
const card: Scorecard = { id: "s", versionId: "v", createdAt: "2026-10-10T21:00:00Z", sources: [{ projectId: "p1", title: "MealMinder", url: "https://devpost.com/software/p1" }],
  criteria: [c("Originality", 4, { label: "supported", against: [pt("Close to MealMinder", ["p1"])] }), c("Technical Understanding", 3), c("Functionality", 2), c("Design", null, { for: [] }), c("Wow Factor", 3)] };
const render = (view: View) => renderToStaticMarkup(createElement(ScorecardView, { view, onScore: () => {}, onOpen: () => {} })).replaceAll("<!-- -->", "");

test("five rows: criterion, score as text and a meter, expandable points for and against with worded badges", () => {
  const html = render({ kind: "ready", card });
  expect(html.match(/<li class="[^"]*" data-criterion=/g)).toHaveLength(5);
  expect(html).toContain("4 out of 5");
  expect(html).toMatch(/<meter[^>]*min="0" max="5" value="4" aria-label="Originality: 4 out of 5"/);
  expect(html).toMatch(/<details><summary>.*Originality/);
  expect(html).toContain('aria-label="For"');
  expect(html).toContain('aria-label="Against"');
  expect(html).toMatch(/data-label="supported">.*supported<\/span> Originality strength/);
  expect(html).toMatch(/data-label="inferred">.*inferred<\/span> Technical Understanding weakness/);
  expect(html).toContain('<button type="button" class="');
  expect(html).toMatch(/>MealMinder<\/button>/); // a cited project, opened in the drawer by onOpen
});

test("a null score reads 'evidence is insufficient' with no meter; no total or odds anywhere", () => {
  const html = render({ kind: "ready", card });
  expect(html).toMatch(/data-criterion="Design">.*data-score="none">evidence is insufficient<\/span>/);
  expect(html.match(/<meter/g)).toHaveLength(4);
  expect(html).toContain("None given.");
  expect(html).not.toMatch(/total|odds|chance|probab|\/ 25|out of 25/i);
});

test("loading, empty, scoring and failed use PanelState; failure offers retry", () => {
  expect(render({ kind: "loading" })).toMatch(/disabled=""[^>]*>Score this idea/);
  expect(render({ kind: "empty" })).toContain("Not scored yet.");
  expect(render({ kind: "scoring" })).toContain("Scoring against the rubric…");
  const failed = render({ kind: "failed", error: "The scorecard is temporarily unavailable." });
  expect(failed).toContain('role="alert"');
  expect(failed).toContain(">Retry</button>");
  expect(render({ kind: "ready", card })).toContain(">Score again</button>");
});
