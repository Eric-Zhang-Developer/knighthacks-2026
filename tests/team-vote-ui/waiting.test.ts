import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import Waiting from "@/components/votes/Waiting";

// #220: with one member the panel used to wait forever with no hint. The vote API has no member count, so the hint
// must hold for both cases: nobody joined yet, and a joined teammate who hasn't voted.
test("the waiting state explains the reveal and points at the invite control", () => {
  const html = renderToStaticMarkup(createElement(Waiting));
  expect(html).toContain("Waiting for your teammate to vote.");
  expect(html).toContain("Both teammates must vote before either vote is shown.");
  expect(html).toContain("Invite a teammate");
  expect(html).not.toMatch(/hasn't joined|no teammate has joined|alone/i); // never claims the teammate is absent
});
