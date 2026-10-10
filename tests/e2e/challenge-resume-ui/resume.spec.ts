import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import { copyFile, readdir, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Real sessions, saves (real embeddings), challenge routes and Neon test branch; generation reads challenge-ui's fixtures
// from AI_STUB_DIR (a fresh absolute folder). Stuck sessions are seeded on the test branch, as only a crash makes them.
test.use({ trace: "off" }); // traces would hold the session cookie
const fixtures = join(__dirname, "..", "challenge-ui", "fixtures");
const panel = (page: Page) => page.getByRole("region", { name: "Challenge" });
const rounds = (page: Page) => panel(page).getByRole("list", { name: "Rounds" }).getByRole("listitem").filter({ hasText: /^Round/ });
const sql = () => neon(process.env.TEST_DATABASE_URL!);

async function setup(page: Page) {
  const stub = process.env.AI_STUB_DIR;
  expect(stub && isAbsolute(stub), "Set AI_STUB_DIR to a fresh absolute temp folder").toBeTruthy();
  expect(process.env.DATABASE_URL === process.env.TEST_DATABASE_URL, "App and verifier must both use the test branch").toBe(true);
  for (const f of await readdir(fixtures)) await copyFile(join(fixtures, f), join(stub!, f));
  await page.goto("/");
  await expect(page.locator("[data-workspace-id]")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals.");
  await page.getByRole("button", { name: "Interpret" }).click();
  await page.getByRole("region", { name: "Your idea" }).getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("region", { name: "Your idea" })).toHaveAttribute("data-version-id", /.+/, { timeout: 60_000 });
  const versionId = (await page.getByRole("region", { name: "Your idea" }).getAttribute("data-version-id"))!;
  // Round 1 must cite a real neighbour of the saved idea, quoted the way the server checks it (as in challenge-ui).
  const ideas = (await (await page.request.get("/api/ideas")).json()) as { versionId: string; neighborIds: string[] }[];
  const neighbour = ideas.find((i) => i.versionId === versionId)!.neighborIds[0];
  const record = (await (await page.request.get(`/api/projects/${neighbour}`)).json()) as Record<string, string | null>;
  const quote = [record.description, record.tagline, record.title].find((t) => t?.trim())!.trim().slice(0, 120);
  await writeFile(join(stub!, "challenge-round-1.json"), JSON.stringify({ question: "How would your team check the meal step helps them decide?",
    assumption: "Teammates can agree on a shared meal.", source: { text: quote, label: "supported", sourceIds: [record.id] }, test: null }));
  return versionId;
}
const writes = (page: Page) => {
  const seen: string[] = [];
  page.on("request", (r) => { if (r.method() !== "GET" && new URL(r.url()).pathname.startsWith("/api/challenge")) seen.push(new URL(r.url()).pathname); });
  return seen;
};

test("reload resumes the session: answered round, then an open question answered in the same session; a new version starts fresh", async ({ page }) => {
  test.setTimeout(180_000);
  const versionId = await setup(page);
  await panel(page).getByRole("button", { name: "Challenge my idea" }).click();
  await expect(rounds(page)).toHaveCount(1, { timeout: 30_000 });
  await panel(page).getByRole("textbox", { name: "Your answer" }).fill("We'd try it at the next team dinner.");
  await panel(page).getByRole("button", { name: "Answer" }).click();
  await expect(rounds(page).first()).toContainText("Outcome: Revise the idea");
  const [session] = await sql()`select id from challenge_sessions where version_id = ${versionId}::uuid`;

  // 1. Reload: round 1 and its answer show, the next round is offered, and the reload wrote nothing.
  let seen = writes(page);
  await page.reload();
  await expect(rounds(page)).toHaveCount(1, { timeout: 30_000 });
  await expect(rounds(page).first()).toContainText("Your answer: We'd try it at the next team dinner.");
  await expect(rounds(page).first()).toContainText("Outcome: Revise the idea");
  await expect(panel(page).getByRole("button", { name: "Next question" })).toBeVisible();
  await page.waitForTimeout(2000); // other panels poll, so the network never idles; any write would have fired by now
  expect(seen).toEqual([]);

  // 2. Round 2 open, reload: its answer box shows, and answering continues the same session.
  await panel(page).getByRole("button", { name: "Next question" }).click();
  await expect(rounds(page)).toHaveCount(2, { timeout: 30_000 });
  seen = writes(page);
  await page.reload();
  await expect(rounds(page)).toHaveCount(2, { timeout: 30_000 });
  await expect(panel(page).getByRole("textbox", { name: "Your answer" })).toBeVisible();
  await page.waitForTimeout(2000); // other panels poll, so the network never idles; any write would have fired by now
  expect(seen).toEqual([]);
  await panel(page).getByRole("textbox", { name: "Your answer" }).fill("A quick poll in the team chat.");
  await panel(page).getByRole("button", { name: "Answer" }).click();
  await expect(rounds(page).nth(1)).toContainText("Outcome:");
  expect(seen).toEqual([`/api/challenge/${session.id}/answer`]);
  await panel(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("resumed.png") });

  // 3. A version with no session: the start state.
  await page.getByRole("region", { name: "Your idea" }).getByRole("button", { name: "New idea" }).click();
  await page.getByRole("textbox", { name: "Describe your idea" }).fill("Help hackathon teammates plan shared meals.");
  await page.getByRole("button", { name: "Interpret" }).click();
  await page.getByRole("region", { name: "Your idea" }).getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("region", { name: "Your idea" })).not.toHaveAttribute("data-version-id", versionId, { timeout: 60_000 });
  await expect(panel(page).getByRole("button", { name: "Challenge my idea" })).toBeEnabled({ timeout: 30_000 });
  await expect(rounds(page)).toHaveCount(0);
});

test("a stuck session: unfinished round renders, live lease refuses, expired lease skips in the same session, round 3 ends", async ({ page }) => {
  test.setTimeout(180_000);
  const versionId = await setup(page);
  const db = sql(), sessionId = randomUUID();
  const source = JSON.stringify({ text: "Teams pick meals together", label: "inferred", sourceIds: [] });
  await db`insert into challenge_sessions (id, version_id, perspective, round_count, state, operation_id, busy_until)
    values (${sessionId}::uuid, ${versionId}::uuid, 'user', 2, 'generating', ${randomUUID()}::uuid, now() + interval '5 minutes')`;
  await db`insert into challenge_rounds (session_id, round, status, question, assumption, source, answer, outcome) values
    (${sessionId}::uuid, 1, 'answered', 'Who decides?', 'One person picks', ${source}::jsonb, 'We vote', 'answered well'),
    (${sessionId}::uuid, 2, 'generating', null, null, null, null, null)`;
  const row = async () => (await db`select round_count, state from challenge_sessions where id = ${sessionId}::uuid`)[0];

  // Round 2 never finished (source null): no crash, "Still working", and skip is offered with the lease live.
  await page.reload();
  await expect(rounds(page)).toHaveCount(2, { timeout: 30_000 });
  await expect(rounds(page).first()).toContainText("Round 1 of 3 · user");
  await expect(panel(page).getByRole("status").filter({ hasText: "Still working" })).toBeVisible();
  await panel(page).getByRole("button", { name: "Skip to the next round" }).click();
  await expect(panel(page).getByRole("alert")).toContainText("Still working; try again shortly.");
  expect(await row()).toEqual({ round_count: 2, state: "generating" });

  // The lease expires: "Check again" re-reads once, and skipping starts round 3 in the same session.
  await db`update challenge_sessions set busy_until = now() - interval '1 minute' where id = ${sessionId}::uuid`;
  await panel(page).getByRole("button", { name: "Check again" }).click();
  await panel(page).getByRole("button", { name: "Skip to the next round" }).click();
  await expect(rounds(page)).toHaveCount(3, { timeout: 30_000 });
  await expect(rounds(page).nth(1)).toContainText("This round didn't finish.");
  expect(await row()).toEqual({ round_count: 3, state: "awaiting" });
  expect((await db`select count(*)::int as n from challenge_sessions where version_id = ${versionId}::uuid`)[0].n).toBe(1);

  // Stuck at round 3: the ended message and Start over, with no skip.
  await db`update challenge_sessions set state = 'answering', busy_until = now() - interval '1 minute' where id = ${sessionId}::uuid`;
  await page.reload();
  await expect(panel(page)).toContainText("This challenge ended before its last round finished.", { timeout: 30_000 });
  await expect(panel(page).getByRole("button", { name: "Start over" })).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "Skip to the next round" })).toHaveCount(0);
  await expect(panel(page).getByText("Still working on this round.")).toHaveCount(0); // ended, not waiting
  await expect(rounds(page).nth(1)).toContainText("This round didn't finish."); // earlier unfinished rounds still say so
  await panel(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("stuck.png") });
});
