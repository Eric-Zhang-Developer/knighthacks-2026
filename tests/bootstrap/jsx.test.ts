import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import Drawer from "@/components/drawer";

// Unit tests import .tsx components; tsconfig's `jsx: preserve` (for Next) must not leak into Vitest.
it("compiles a .tsx component under Vitest", () => {
  expect(renderToStaticMarkup(createElement(Drawer))).toBe("");
});
