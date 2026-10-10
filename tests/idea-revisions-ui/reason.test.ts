import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { RevisionReason } from "@/components/revisions/reason";

test("legacy model-written reasons render an inferred badge and escaped text", () => {
  const html = renderToStaticMarkup(createElement(RevisionReason, { reason: "A <narrower> audience is testable." }));
  expect(html).toContain('data-label="inferred"');
  expect(html).toContain("inferred</span>");
  expect(html).toContain("A &lt;narrower&gt; audience is testable.");
});

test.each(["supported", "inferred", "unverified"] as const)("checked %s reasons preserve the API label and text", (label) => {
  const html = renderToStaticMarkup(createElement(RevisionReason, {
    reason: { text: "A reason from the API.", label, sourceIds: label === "supported" ? ["stored-source"] : [] },
  }));
  expect(html).toContain(`data-label="${label}"`);
  expect(html).toContain(`${label}</span>`);
  expect(html).toContain("A reason from the API.");
});
