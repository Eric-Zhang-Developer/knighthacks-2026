import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClaimBadge, PanelState, type ClaimLabel, type PanelStateKind } from "@/components/ui";

// Read the real tokens, so a token edit that breaks contrast fails here.
const css = readFileSync("app/globals.css", "utf8");
const token = (name: string) => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"));
  if (!m) throw new Error(`token --${name} not found`);
  return m[1];
};
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("visual polish", () => {
  it.each(["text", "muted", "idea", "uncertain", "live", "history", "failed"])("--%s on --panel meets AA", (fg) => {
    expect(contrast(token(fg), token("panel"))).toBeGreaterThanOrEqual(4.5);
  });
  it.each(["text", "muted"])("--%s on --bg meets AA", (fg) => {
    expect(contrast(token(fg), token("bg"))).toBeGreaterThanOrEqual(4.5);
  });

  it("every claim badge carries its label as text and a distinct shape", () => {
    const labels: ClaimLabel[] = ["supported", "inferred", "unverified"];
    const html = labels.map((label) => renderToStaticMarkup(createElement(ClaimBadge, { label })));
    html.forEach((h, i) => expect(h).toContain(`>${labels[i]}</span>`));
    const shapes = html.map((h) => h.match(/aria-hidden="true">(.)</)?.[1]);
    expect(new Set(shapes).size).toBe(labels.length);
  });

  it("every panel state says what happened, failures as alerts", () => {
    const kinds: PanelStateKind[] = ["loading", "empty", "partial", "failed", "offline"];
    for (const kind of kinds) {
      const html = renderToStaticMarkup(createElement(PanelState, { kind, message: `msg-${kind}` }));
      expect(html).toContain(`msg-${kind}`);
      expect(html).toContain(kind === "failed" || kind === "offline" ? 'role="alert"' : 'role="status"');
    }
    const retry = renderToStaticMarkup(createElement(PanelState, { kind: "failed", onRetry: () => {} }));
    expect(retry).toContain("Something went wrong.");
    expect(retry).toContain(">Retry</button>");
  });
});
