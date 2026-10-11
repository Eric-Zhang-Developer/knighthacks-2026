import { test } from "@playwright/test";
import { configuredProviders } from "../../live-smoke/contracts";
import { runPass } from "../../live-smoke/pass";

test.use({ trace: "off", screenshot: "off", video: "off" });
// Fail during discovery, before Playwright starts any server or provider call.
const providers = configuredProviders(process.env);
test("all configured live providers complete the real API chain with mission claims", async ({ playwright }, info) => {
  test.setTimeout(350000);
  const failures = await Promise.all(providers.map((provider) => runPass(provider, playwright, info)));
  const failed = failures.filter(Boolean);
  if (failed.length) throw new Error(failed.join("\n"));
});

