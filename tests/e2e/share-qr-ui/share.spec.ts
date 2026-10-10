import { expect, test } from "@playwright/test";
import interpretation from "./fixtures/idea-interpret.json";

// Gemini is stubbed on the server through AI_STUB_DIR (this folder's fixtures); embeddings and Neon are real.
test.use({ trace: "off" }); // traces would hold the session cookie

test("share a chosen snapshot: a fresh phone browser reads it with no cookie, and revoking makes it 410", async ({ page, browser }) => {
  test.setTimeout(180_000);
  expect(process.env.AI_STUB_DIR, "Start the server with AI_STUB_DIR=tests/e2e/share-qr-ui/fixtures").toBeTruthy();
  await page.goto("/");
  await expect(page.locator("[data-workspace-id]")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals.");
  await page.getByRole("button", { name: "Interpret" }).click();
  await page.getByRole("region", { name: "Your idea" }).getByRole("button", { name: "Save" }).click();

  // Nothing to share until a version is chosen.
  const share = page.getByRole("region", { name: "Share" });
  await share.getByRole("button", { name: "Create a read-only link" }).click({ timeout: 60_000 });
  await expect(share.getByRole("alert")).toContainText("Choose a version in Decide first");

  await page.getByRole("region", { name: "Decision" }).getByRole("button", { name: "Choose this version" }).click();
  await expect(page.getByRole("article", { name: "Decision snapshot" })).toBeVisible({ timeout: 30_000 });
  await share.getByRole("button", { name: "Create a read-only link" }).click();
  const link = share.locator("[data-share-url]");
  await expect(link).toHaveText(/\/s\/[^/]+$/);
  const url = (await link.textContent())!;
  await expect(share.getByRole("img", { name: "QR code for the share link" })).toHaveAttribute("src", /^data:image\/png;base64,/);

  // A stranger's phone: a fresh context with no cookies.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const visitor = await phone.newPage();
  const setCookies: string[] = [];
  visitor.on("response", async (r) => {
    const h = await r.headerValue("set-cookie");
    if (h) setCookies.push(`${r.url()}: ${h}`);
  });
  await visitor.goto(url);
  const shared = visitor.getByRole("article", { name: "Shared decision" });
  await expect(shared.getByRole("heading", { level: 1 })).toHaveText(interpretation.title, { timeout: 30_000 });
  await expect(shared).toContainText(interpretation.workflow);
  await visitor.screenshot({ path: test.info().outputPath("phone.png"), fullPage: true });
  // Wait for every request the page makes, so a late session request can't slip past the cookie check.
  await visitor.waitForLoadState("networkidle");
  expect(await phone.cookies(), "the share page must not set a workspace cookie").toEqual([]);
  expect(setCookies).toEqual([]);

  // The owner revokes; the visitor now gets the plain revoked message, and the API answers 410.
  await share.getByRole("button", { name: "Revoke link" }).click();
  await expect(share).toContainText("Link revoked");
  await visitor.reload();
  await expect(visitor.getByRole("status")).toHaveText("This link was revoked by its owner.");
  expect((await visitor.request.get(`/api/shares/${url.split("/s/")[1]}`)).status()).toBe(410);
  await phone.close();
});
