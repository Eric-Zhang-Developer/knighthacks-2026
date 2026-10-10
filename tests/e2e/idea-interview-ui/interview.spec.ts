import { copyFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import answeredFields from "./fixtures/idea-interpret-answered.json";
import round1 from "./fixtures/questions-round-1.json";

// Real interpret, save and embedding routes on the Neon test branch; Gemini is stubbed through AI_STUB_DIR (a fresh
// absolute folder). POST /api/ideas/questions is stubbed in the browser: idea-interview-api builds the real route.
test.use({ trace: "off" }); // traces would hold the session cookie
const fixtures = join(__dirname, "fixtures");
const panel = (page: Page) => page.getByRole("region", { name: "Your idea" });
const questions = (page: Page) => panel(page).getByRole("region", { name: "Follow-up questions" });
const ANSWERS = ["Group project deadlines slip because nobody sees who is blocked", "Each member posts a one-line daily status"];

function stubDir() {
  const stub = process.env.AI_STUB_DIR;
  expect(Boolean(stub) && isAbsolute(stub!), "Start the server with a fresh absolute AI_STUB_DIR").toBe(true);
  return stub!;
}
const useInterpretation = (stub: string, name: string) => copyFile(join(fixtures, `${name}.json`), join(stub, "idea-interpret.json"));

async function interpretVague(page: Page) {
  await page.goto("/");
  await expect(page.locator("[data-workspace-id]")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("textbox", { name: "Describe your idea" }).fill("an app for students");
  await page.getByRole("button", { name: "Interpret" }).click();
}

test("questions appear for a vague idea; answers are re-read into the fields and saved in version 1", async ({ page }) => {
  test.setTimeout(180_000);
  const stub = stubDir();
  await useInterpretation(stub, "idea-interpret-vague");
  const asked: { fields: Record<string, string | null>; answers: { question: string; field: string; answer: string }[] }[] = [];
  await page.route("**/api/ideas/questions", async (route) => {
    const body = route.request().postDataJSON();
    asked.push(body);
    await route.fulfill({ json: body.answers.length ? { questions: [], done: true } : round1 });
  });
  const read: string[] = [];
  page.on("request", (r) => new URL(r.url()).pathname === "/api/ideas/interpret" && read.push(r.postDataJSON().text));

  await interpretVague(page);
  const rows = questions(page).getByRole("listitem");
  await expect(rows).toHaveCount(2, { timeout: 60_000 });
  await expect(rows.nth(0)).toContainText(round1.questions[0].question);
  await expect(rows.nth(0)).toContainText(round1.questions[0].why);
  expect(asked[0].fields.problem).toBeNull(); // the route saw the interpretation, gaps and all
  await page.screenshot({ path: test.info().outputPath("questions.png"), fullPage: true });

  // The model reads the answers from the re-sent text; the stub stands in for that reading.
  await useInterpretation(stub, "idea-interpret-answered");
  for (const [i, q] of round1.questions.entries()) await panel(page).getByRole("textbox", { name: q.question }).fill(ANSWERS[i]);
  await questions(page).getByRole("button", { name: "Use my answers" }).click();

  await expect(panel(page).getByRole("status")).toContainText("That covers what was unclear", { timeout: 60_000 });
  expect(read).toHaveLength(2);
  for (const [i, q] of round1.questions.entries()) expect(read[1]).toContain(`${q.question} ${ANSWERS[i]}`);
  expect(asked[1].answers.map((a) => a.answer)).toEqual(ANSWERS);
  await expect(panel(page).getByLabel("Problem")).toHaveValue(answeredFields.problem);
  await expect(panel(page).getByLabel("Workflow")).toHaveValue(answeredFields.workflow);
  await page.screenshot({ path: test.info().outputPath("answered.png"), fullPage: true });

  await panel(page).getByRole("button", { name: "Save" }).click();
  await expect(panel(page)).toHaveAttribute("data-version-id", /.+/, { timeout: 60_000 });
  const versionId = await panel(page).getAttribute("data-version-id");
  const saved = ((await (await page.request.get("/api/ideas")).json()) as Record<string, string>[]).find((v) => v.versionId === versionId)!;
  expect(saved.problem).toBe(answeredFields.problem);
  expect(saved.workflow).toBe(answeredFields.workflow);
});

test("Skip saves immediately, as before", async ({ page }) => {
  test.setTimeout(180_000);
  await useInterpretation(stubDir(), "idea-interpret-vague");
  await page.route("**/api/ideas/questions", (route) => route.fulfill({ json: round1 }));
  await interpretVague(page);
  await expect(questions(page).getByRole("listitem")).toHaveCount(2, { timeout: 60_000 });
  await questions(page).getByRole("button", { name: "Skip and save" }).click();
  await expect(panel(page)).toHaveAttribute("data-version-id", /.+/, { timeout: 60_000 });
  await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText("Student app");
});

test("without the questions route (404) the interview is skipped silently and Save works", async ({ page }) => {
  test.setTimeout(180_000);
  await useInterpretation(stubDir(), "idea-interpret-vague");
  let called = false;
  await page.route("**/api/ideas/questions", (route) => ((called = true), route.fulfill({ status: 404, json: { error: "Not found" } })));
  await interpretVague(page);
  await expect(panel(page).getByRole("heading", { name: "Check the interpretation" })).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => called).toBe(true);
  await expect(questions(page)).toHaveCount(0);
  await expect(panel(page).getByText(/questions|unclear/i)).toHaveCount(0);
  await panel(page).getByRole("button", { name: "Save" }).click();
  await expect(panel(page)).toHaveAttribute("data-version-id", /.+/, { timeout: 60_000 });
});
