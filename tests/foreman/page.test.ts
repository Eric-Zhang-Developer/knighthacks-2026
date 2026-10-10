import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("next/font/google", () => ({ IBM_Plex_Mono: () => ({ variable: "m" }) }));
vi.mock("next/font/local", () => ({ default: () => ({ variable: "s" }) }));

const render = async () => {
  const { default: ForemanPage } = await import("@/app/foreman/page");
  return renderToStaticMarkup(await ForemanPage()).replaceAll("<!-- -->", "");
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test("built without a token: the board from the repo files, a banner, and no network call", async () => {
  vi.stubEnv("GITHUB_TOKEN", "");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const html = await render();
  expect(fetch).not.toHaveBeenCalled();
  expect(html).toContain("Will we make it");
  expect(html).toContain("Watch it get built");
  expect(html).toContain("PR data missing");
  expect(html).toContain("API: no token");
  expect(html).toContain('data-state="unknown"');
  // PR-derived numbers are unknown, not zero: no pace, no merge mix, no guardrail counts.
  expect(html).not.toContain("no pace to project");
  expect(html).not.toContain("merged PRs by type");
  expect(html).toMatch(/Guardrails: <b>—<\/b> plan PRs/);
});

// The production failure of 2026-10-10: the API answered 403 and the page showed nothing but the error.
test("GitHub's API answering 403 still leaves a board built from the repo files", async () => {
  vi.stubEnv("GITHUB_TOKEN", "t");
  vi.stubGlobal("fetch", vi.fn(async () => new Response("API rate limit exceeded", { status: 403 })));
  const html = await render();
  expect(html).toContain("Will we make it");
  expect(html).toContain("GitHub 403 on /pulls (rate limit?)");
  expect(html).toContain("API: failed");
  expect(html).not.toContain("unavailable");
});
