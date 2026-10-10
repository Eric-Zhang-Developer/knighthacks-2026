import { expect, test } from "vitest";

// Validation 4: the deployed page, checked by its content (an error page also answers 200). Skipped unless
// FOREMAN_URL is set, e.g. FOREMAN_URL=https://knighthacks-2026.vercel.app pnpm exec vitest run tests/foreman/production.test.ts
const URL = process.env.FOREMAN_URL;

test.skipIf(!URL)("the live page is a full snapshot of the deployed commit, built with a working token", async () => {
  const [res, health] = await Promise.all([fetch(`${URL}/foreman`, { cache: "no-store" }), fetch(`${URL}/api/health`, { cache: "no-store" })]);
  expect(res.status).toBe(200);
  const html = (await res.text()).replaceAll("<!-- -->", "");
  const { commit } = (await health.json()) as { commit: string };
  // Named booleans, not toContain on the page: a failure should say which check, not print 50 KB of HTML.
  const has = (what: string, ok: boolean) => expect(ok, what).toBe(true);
  for (const section of ["Will we make it", "Needs a person", "How it gets built", "The site plan", "The crew"]) has(section, html.includes(section));
  has(`built from the deployed commit ${commit.slice(0, 7)}`, html.includes(`data-sha="${commit}"`));
  has("API: token stamp", /API: token · \d+ calls/.test(html));
  has("no PR-data-missing banner", !html.includes('data-testid="degraded"'));
  has("no token in the HTML", !/ghp_|gho_|github_pat_/.test(html));
});
