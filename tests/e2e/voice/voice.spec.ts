import { expect, test } from "@playwright/test";

const bar = (page: import("@playwright/test").Page) => page.getByLabel("Voice", { exact: true });

test("mic denied: a notice shows, no token is spent and nothing reaches the draft", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
  });
  let tokenRequests = 0;
  page.on("request", (r) => r.url().endsWith("/api/voice/token") && tokenRequests++);
  await page.goto("/");
  const talk = bar(page).getByRole("button", { name: "Hold to talk" });
  await talk.focus();
  await page.keyboard.down(" ");
  await expect(bar(page).getByRole("alert")).toHaveText(/Microphone blocked/);
  await page.keyboard.up(" ");
  await expect(bar(page).getByText(/Added to your idea/)).toHaveCount(0);
  await expect(bar(page).getByRole("button", { name: "End voice session" })).toBeVisible();
  expect(tokenRequests).toBe(0);
  await page.screenshot({ path: test.info().outputPath("mic-denied.png") });
});

test("provider down: a notice shows and the bar stays usable", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => new MediaStream();
  });
  await page.route("**/api/voice/token", (r) => r.fulfill({ status: 503, json: { error: "voice unavailable" } }));
  await page.goto("/");
  const talk = bar(page).getByRole("button", { name: "Hold to talk" });
  await talk.dispatchEvent("pointerdown");
  await expect(bar(page).getByRole("alert")).toHaveText(/Voice is unavailable/);
  await expect(bar(page).getByText(/Added to your idea/)).toHaveCount(0);
  await expect(talk).toBeEnabled();
});

test("token route: a single-use token, never the key", async ({ request }) => {
  const key = process.env.ELEVENLABS_API_KEY;
  test.skip(!key, "ELEVENLABS_API_KEY not set (#11); the 200 path is unit-tested with a mocked SDK");
  const res = await request.post("/api/voice/token");
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(JSON.parse(body).token).toEqual(expect.any(String));
  expect(body).not.toContain(key!);
});

test("token route without a key: 503, nothing leaked", async ({ request }) => {
  test.skip(!!process.env.ELEVENLABS_API_KEY, "key is set");
  const res = await request.post("/api/voice/token");
  expect(res.status()).toBe(503);
  expect(await res.json()).toEqual({ error: "voice unavailable" });
});
