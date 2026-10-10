import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock("next/font/google", () => ({ Big_Shoulders_Stencil: () => ({ variable: "s" }), IBM_Plex_Mono: () => ({ variable: "m" }) }));
vi.mock("@/lib/foreman/github", () => ({ REPO: "o/r", readRaw: () => Promise.reject(new Error("GitHub 403 on /commits/main (rate limit?)")) }));

test("with GitHub unreachable the page says so instead of showing a guess", async () => {
  const { default: ForemanPage } = await import("@/app/foreman/page");
  const html = renderToStaticMarkup(await ForemanPage());
  expect(html).toContain("GitHub data unavailable: GitHub 403 on /commits/main (rate limit?)");
  expect(html).not.toContain("Will we make it");
});
