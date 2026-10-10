import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
test.use({ trace: "off" });
test("production readiness accepts only this run and ordinary health remains available", async ({ request }) => {
  const token = process.env.UNCHARTED_VERIFY_TOKEN;
  expect(Boolean(token)).toBe(true);
  const matching = await request.get(`/api/health/verify/${token}`);
  expect(matching.status()).toBe(200); expect(await matching.json()).toEqual({ ready: true });
  const wrong = await request.get(`/api/health/verify/${"0".repeat(48)}`);
  expect(wrong.status()).toBe(404);
  const health = await request.get("/api/health");
  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  expect(health.status()).toBe(200); expect(await health.json()).toEqual({ commit });
});
