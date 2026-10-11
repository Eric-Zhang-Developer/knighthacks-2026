import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import NewsCards, { type MentorNews } from "../../components/mentor/NewsCards";
import { readNewsData } from "../../components/mentor/protocol";

const news: MentorNews = { query: "Recent reporting about: study rooms", asOf: "2026-10-11T15:00:00.000Z", windowStart: "2026-10-04T15:00:00.000Z", model: "test",
  items: [{ claim: { text: "Students reported a shortage.", label: "supported", sourceIds: ["news-0-0"] },
    source: { id: "news-0-0", title: "Campus report", url: "https://publisher.test/report" }, publishedAt: "2026-10-10",
    relevance: { text: "Directly concerns the stated problem.", label: "inferred", sourceIds: ["news-0-0"] } }],
  limitations: ["Fresh and non-exhaustive."] };

describe("recent mentor news cards", () => {
  it("accepts valid news but rejects failed replays and malformed payloads before state update", () => {
    expect(readNewsData(news)).toEqual(news);
    expect(readNewsData({ status: "failed", error: "Provider unavailable" })).toBeNull();
    expect(readNewsData({ ...news, asOf: undefined })).toBeNull();
    expect(readNewsData({ ...news, items: [{ ...news.items[0], claim: { ...news.items[0].claim, label: "unverified" } }] })).toBeNull();
    expect(readNewsData({ ...news, items: [{ ...news.items[0], publishedAt: "unknown" }] })).toBeNull();
  });
  it("renders verified dates, supported claims, inferred relevance, sources, and limitations", () => {
    const html = renderToStaticMarkup(createElement(NewsCards, { news }));
    expect(html).toContain('aria-label="Recent problem news"');
    expect(html).toContain("LAST 7 DAYS");
    expect(html).toContain("2026-10-10");
    expect(html).toContain("supported");
    expect(html).toContain("inferred");
    expect(html).toContain('href="https://publisher.test/report"');
    expect(html).toContain("Fresh and non-exhaustive");
  });
  it("escapes source content, rejects executable links, and keeps an honest empty result", () => {
    const unsafe = { ...news, items: [{ ...news.items[0], claim: { ...news.items[0].claim, text: "<script>attack()</script>" },
      source: { ...news.items[0].source, title: "<img onerror=attack>", url: "javascript:attack()" } }] };
    const html = renderToStaticMarkup(createElement(NewsCards, { news: unsafe }));
    expect(html).toContain("&lt;script&gt;"); expect(html).toContain("&lt;img"); expect(html).not.toContain("href=");
    const empty = renderToStaticMarkup(createElement(NewsCards, { news: { ...news, items: [] } }));
    expect(empty).toContain("No relevant news with a verified publication date");
    expect(renderToStaticMarkup(createElement(NewsCards, { news: null }))).toBe("");
  });
});
