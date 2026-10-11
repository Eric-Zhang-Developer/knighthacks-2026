import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import EvidenceCards from "../../components/mentor/EvidenceCards";

const render = (url = "https://example.org/project", excerpt = "Fixture excerpt") => renderToStaticMarkup(createElement(EvidenceCards, {
  projects: [{ projectId: "fixture", title: "Fixture project", url, excerpt }], onInspect: () => undefined,
}));

describe("conversation evidence cards", () => {
  it("renders source evidence without a transcript or conversation-open state", () => {
    const html = render();
    expect(html).toContain('aria-label="Conversation sources"');
    expect(html).toContain("Fixture project");
    expect(html).toContain("Fixture excerpt");
    expect(html).toContain('href="https://example.org/project"');
    expect(html).toContain("Inspect project");
    expect(html).not.toContain("hidden");
    expect(html).toContain("Latest conversation search");
  });
  it("renders nothing when no evidence exists", () => {
    expect(renderToStaticMarkup(createElement(EvidenceCards, { projects: [], onInspect: () => undefined }))).toBe("");
  });
  it("does not manufacture excerpts or emit executable source links", () => {
    const html = render("javascript:alert(1)", "");
    expect(html).toContain("No excerpt available");
    expect(html).not.toContain("href=");
    expect(render("https://example.org/project", "<script>attack()</script>")).toContain("&lt;script&gt;");
  });
});
