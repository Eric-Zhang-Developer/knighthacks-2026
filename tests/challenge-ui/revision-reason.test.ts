import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ChallengeRevisionReason } from "@/components/challenge/revision-reason";

test("the deployed string API remains readable and gains an inferred badge", () => {
  const html = renderToStaticMarkup(createElement(ChallengeRevisionReason, { reason: "A <narrower> audience is testable." }));
  expect(html).toContain('data-label="inferred"');
  expect(html).toContain("inferred</span>");
  expect(html).toContain("A &lt;narrower&gt; audience is testable.");
});

test.each(["supported", "inferred", "unverified"] as const)("a checked %s Claim renders its text and label", (label) => {
  const html = renderToStaticMarkup(createElement(ChallengeRevisionReason, {
    reason: { text: "A reason from the API.", label, sourceIds: label === "supported" ? ["stored-source"] : [] },
  }));
  expect(html).toContain(`data-label="${label}"`);
  expect(html).toContain(`${label}</span>`);
  expect(html).toContain("A reason from the API.");
});
