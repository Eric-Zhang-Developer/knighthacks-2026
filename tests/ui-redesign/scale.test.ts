import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// specs/features/ui-redesign Validation 1: owned stylesheets use the type, shape and space scales, and the text tokens
// read on the panel fill. The file list comes from the spec's own `owns`, so a newly owned stylesheet is checked too.
const spec = readFileSync("specs/features/ui-redesign/spec.md", "utf8");
const owned = spec.match(/^owns: \[(.*)\]$/m)![1].split(", ").filter((p) => p.endsWith(".css"));

const decls = (file: string) =>
  [...readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(-{0,2}[a-z-]+)\s*:\s*([^;{}]+);/g)].map(([, prop, value]) => ({ prop, value: value.trim() }))
    .filter((d) => !d.prop.startsWith("--")); // token definitions are the scale itself

const SIZE = /^(var\(--(text-xs|text-sm|text-md|title|heading|display)\)|inherit)$/;
const RADIUS = /^((var\(--(radius|radius-field|radius-sm|radius-round|md-sys-shape-corner-[a-z-]+)\)|0|50%|inherit)\s*)+$/;
const SPACING = /^(padding|margin|gap|row-gap|column-gap)(-[a-z]+)?$/;
// Hairline nudges (borders, 1-3px insets) are not spacing; anything 4px or more is a token.
const rawSpacing = (value: string) => (value.match(/(?<![\w-])\d+(\.\d+)?px/g) ?? []).filter((px) => parseFloat(px) > 3);

describe.each(owned)("%s", (file) => {
  const all = decls(file);
  it("font sizes come from the type scale", () => {
    const bad = all.filter((d) => (d.prop === "font-size" && !SIZE.test(d.value)) || (d.prop === "font" && /\d+(\.\d+)?px/.test(d.value)));
    expect(bad).toEqual([]);
  });
  it("radii come from the shape scale", () => {
    expect(all.filter((d) => /radius$/.test(d.prop) && !RADIUS.test(d.value))).toEqual([]);
  });
  it("spacing comes from the space scale", () => {
    expect(all.filter((d) => SPACING.test(d.prop) && rawSpacing(d.value).length)).toEqual([]);
  });
});

describe("text tokens read on the panel fill", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const hex = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"))![1];
  const lum = (h: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(h.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  it.each(["ink", "ink-2", "brass-tone", "accent"])("--%s on --panel clears 4.5:1", (fg) => {
    const [hi, lo] = [lum(hex(fg)), lum(hex("panel"))].sort((a, b) => b - a);
    expect((hi + 0.05) / (lo + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
});
