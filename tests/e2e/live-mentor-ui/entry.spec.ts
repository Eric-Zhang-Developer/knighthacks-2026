import { expect, test } from "@playwright/test";

// Deterministic UI boundary checks only. These fixtures are not real audio or
// persistence receipts and cannot satisfy human ElevenLabs acceptance.
test.use({ viewport: { width: 390, height: 844 }, trace: "off" });
test.beforeEach(async ({ page }) => {
  await page.route("**/api/workspace", (route) => route.fulfill({ json: { workspaceId: "fixture-workspace", memberId: "fixture-member" } }));
});

test("one tap requests microphone; mount/hash never listen; denial keeps typing optional and usable", async ({ page }) => {
  let microphoneRequests = 0;
  await page.exposeFunction("recordMicAttempt", () => { microphoneRequests++; });
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { value: async () => {
      await (window as unknown as { recordMicAttempt: () => Promise<void> }).recordMicAttempt();
      throw new DOMException("Denied by test", "NotAllowedError");
    } });
  });
  await page.goto("/#talk");
  const bubble = page.getByRole("button", { name: "Start live voice conversation", exact: true });
  await expect(bubble).toBeEnabled();
  expect(microphoneRequests).toBe(0);
  await expect(page.getByRole("textbox", { name: "Message Uncharted" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start live conversation", exact: true })).toHaveCount(0);
  await bubble.click();
  await expect(page.getByText("Microphone blocked. Continue the conversation by typing below.")).toBeVisible();
  expect(microphoneRequests).toBe(1);
  await page.getByRole("button", { name: "Prefer to type?" }).click();
  await page.getByRole("textbox", { name: "Message Uncharted" }).fill("Keep my idea while voice is unavailable.");
  await page.getByRole("button", { name: "Minimize conversation", exact: true }).click();
  await page.getByRole("link", { name: "Talk", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Message Uncharted" })).toHaveValue("Keep my idea while voice is unavailable.");
  expect(microphoneRequests).toBe(1);
  await page.screenshot({ path: test.info().outputPath("phone-voice-denied.png") });
});

test("three proposals remain separate; only an explicit selected card is saved", async ({ page }) => {
  let sequence = 0;
  let saves = 0;
  let savedTitle = "";
  await page.route("**/api/ideas/interpret", (route) => route.fulfill({ json: {
    title: `Fixture direction ${++sequence}`, description: "Test proposal, not real generated content", audience: "Students", problem: "Planning study time", workflow: "Schedule practice sessions", constraints: null,
  } }));
  await page.route("**/api/ideas/questions", (route) => route.fulfill({ json: { done: true, questions: [] } }));
  await page.route("**/api/ideas", (route) => {
    if (route.request().method() !== "POST") return route.fulfill({ json: [] });
    saves++;
    const fields = route.request().postDataJSON(); savedTitle = fields.title;
    return route.fulfill({ json: { ...fields, ideaId: "fixture-idea", versionId: "fixture-version", neighborIds: [], x: 0, y: 0, z: 0 } });
  });
  await page.goto("/#talk");
  await page.getByRole("button", { name: "Prefer to type?" }).click();
  for (const text of ["Consider a study planner", "Also consider a study partner", "Also consider a practice coach"]) {
    await page.getByRole("textbox", { name: "Message Uncharted" }).fill(text);
    await page.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(page.getByRole("heading", { name: `Fixture direction ${sequence || 1}`, exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Message Uncharted" })).toBeEmpty();
    await expect(page.getByText("Thinking through your idea…")).toHaveCount(0);
  }
  const cards = page.getByRole("region", { name: "Candidate ideas" });
  await expect(cards.getByRole("article")).toHaveCount(3);
  expect(saves).toBe(0);
  await cards.getByRole("article").nth(1).getByRole("button", { name: "Proceed with this idea" }).click();
  await expect(cards.getByText("SAVED IDEA", { exact: true })).toHaveCount(1);
  expect(saves).toBe(1); expect(savedTitle).toBe("Fixture direction 2");
  await expect(cards.getByRole("article")).toHaveCount(3);
  await expect(cards.getByRole("button", { name: "Proceed with this idea" })).toHaveCount(2);
  const say = async (text: string, keepsConversationOpen = true) => {
    await page.getByRole("textbox", { name: "Message Uncharted" }).fill(text);
    await page.getByRole("button", { name: "Send message", exact: true }).click();
    if (keepsConversationOpen) await expect(page.getByRole("textbox", { name: "Message Uncharted" })).toBeEmpty();
  };
  await say("save idea one");
  await expect(page.getByText(/To confirm within one minute/)).toBeVisible();
  expect(saves).toBe(1);
  await say("cancel");
  await say("confirm save idea one");
  await expect(page.getByText(/There is no matching, unchanged save/)).toBeVisible();
  expect(saves).toBe(1);
  await say("save idea one");
  await say("confirm save idea one");
  await expect(cards.getByText("SAVED IDEA", { exact: true })).toHaveCount(2);
  expect(saves).toBe(2); expect(savedTitle).toBe("Fixture direction 1");
  await say("confirm save idea one");
  expect(saves).toBe(2);
  await say("show the map", false);
  await expect(page).toHaveURL(/#explore$/);
  await expect(page.getByRole("region", { name: "Brainstorm conversation" })).toBeHidden();
  await page.getByRole("link", { name: "Talk", exact: true }).click();
  await expect(cards.getByRole("article")).toHaveCount(3);
  await page.getByRole("button", { name: "Hide typing", exact: true }).click();
  await cards.getByRole("heading", { name: "Fixture direction 1" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("phone-candidate-cards-fixtures.png") });
});
