import { afterEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { sameOrigin } from "@/lib/workspace/http";

afterEach(() => vi.unstubAllEnvs());

test("configured application origin survives NextRequest normalization for same-origin writes", async () => {
  vi.stubEnv("UNCHARTED_VERIFY_PORT", "31415");
  vi.stubEnv("UNCHARTED_VERIFY_TOKEN", "a".repeat(48));
  const { default: config } = await import("../../playwright.config");
  const origin = new URL(config.use!.baseURL!).origin;
  const request = new NextRequest(`${origin}/api/workspace`, { method: "POST", headers: { origin } });
  expect(() => sameOrigin(request)).not.toThrow();
  expect(new URL(request.url).origin).toBe(origin);
  const foreign = new NextRequest(`${origin}/api/workspace`, { method: "POST", headers: { origin: "https://foreign.invalid" } });
  expect(() => sameOrigin(foreign)).toThrow("Same-origin request required");
});
