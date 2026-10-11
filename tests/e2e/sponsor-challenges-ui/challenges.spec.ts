import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// specs/features/sponsor-challenges-ui Validation 1-3, in a real browser against the real API and test branch. Models
// are stubbed (AI_STUB_DIR): each step writes the fixture the next model call reads.
test.use({ trace: "off", video: "off" });

const BRIEF = [
  "Acme Maps Challenge.",
  "Teams must be university students.",
  "Projects must use the Acme Maps API.",
  "Submit a 2-minute demo video.",
  "Judging: Innovation 40%, Impact 60%, each scored 0 to 10.",
  "Scoring: 0 = not shown, 5 = partly shown, 10 = fully shown.",
  "Final score is the weighted sum of the criteria.",
].join(" ");
const anchors = [{ points: 0, quote: "0 = not shown" }, { points: 5, quote: "5 = partly shown" }, { points: 10, quote: "10 = fully shown" }];
const scale = { min: 0, max: 10, quote: "each scored 0 to 10" };
const RUBRIC = {
  criteria: [
    { name: "Innovation", quote: "Innovation 40%", scale, anchors, weight: { value: 40, unit: "percent", quote: "Innovation 40%" } },
    { name: "Impact", quote: "Impact 60%", scale, anchors, weight: { value: 60, unit: "percent", quote: "Impact 60%" } },
  ],
  aggregation: [{ rule: "weighted_sum", quote: "Final score is the weighted sum of the criteria." }],
};
const PROPOSAL = {
  requirements: [
    { kind: "eligibility", quote: "Teams must be university students.", summary: "Student teams only" },
    { kind: "required-integration", quote: "Projects must use the Acme Maps API.", summary: null },
    { kind: "deliverable", quote: "Submit slides", summary: null }, // not in the brief: shown only as uncertain
  ],
  rubric: RUBRIC,
  uncertain: [{ text: "2-minute", reason: "Could be 2 or 3 minutes" }],
};
const IDEA = {
  title: "Campus route planner",
  description: "Uses the Acme Maps API to plan walking routes between classes",
  audience: "University students", problem: "Getting lost between classes", workflow: "Pick a class, get a route", constraints: null,
};
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(64).fill(7)]);

const panel = (page: Page) => page.getByRole("region", { name: "Sponsor challenges" });
async function toDecide(page: Page) {
  const nav = page.getByRole("navigation", { name: "Destinations" }).getByRole("link", { name: "Decide" });
  if (await nav.isVisible()) await nav.click();
  await panel(page).scrollIntoViewIfNeeded();
}

test("sponsor challenges: import, review, confirm, assess with cited reasons, reload, revise, fail and retry, delete", async ({ page, browser, baseURL }, info) => {
  test.setTimeout(300_000);
  const fixtures = process.env.AI_STUB_DIR;
  expect(Boolean(fixtures) && isAbsolute(fixtures!), "AI_STUB_DIR must be an absolute path").toBe(true);
  expect(process.env.AI_STUB_ALLOW).toBe("1");
  await mkdir(fixtures!, { recursive: true });
  const fixture = (key: string, value: unknown) => writeFile(join(fixtures!, `${key}.json`), JSON.stringify(value));
  const origin = new URL(baseURL!).origin;

  // A saved idea in this browser's workspace.
  await page.goto("/");
  expect((await page.request.post("/api/workspace", { headers: { origin } })).ok()).toBe(true);
  const idea = await (await page.request.post("/api/ideas", { headers: { origin, "Idempotency-Key": randomUUID() }, data: IDEA })).json();
  expect(idea.versionId).toBeTruthy();
  await page.reload();
  await toDecide(page);
  const p = panel(page);
  await expect(p).toBeVisible({ timeout: 30_000 });

  // --- Client-side image checks keep the typed text and say why, in words.
  await p.getByLabel("Challenge text").fill(BRIEF);
  const file = p.getByLabel(/Challenge image/);
  await file.setInputFiles({ name: "brief.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
  await expect(p.getByRole("alert")).toContainText("PNG or JPEG");
  await file.setInputFiles({ name: "huge.png", mimeType: "image/png", buffer: Buffer.alloc(2 * 1024 * 1024 + 1, 1) });
  await expect(p.getByRole("alert")).toContainText("over 2 MB");
  await expect(p.getByLabel("Challenge text")).toHaveValue(BRIEF);

  // --- An unreadable image with no text is refused; the text path still works.
  await p.getByLabel("Challenge text").fill("");
  await file.setInputFiles({ name: "blank.png", mimeType: "image/png", buffer: PNG });
  await expect(p.getByRole("img", { name: "Preview of the chosen challenge image" })).toBeVisible();
  await fixture("sponsor-challenge-image", { legibility: "none", transcript: "", uncertain: [] });
  await p.getByRole("button", { name: "Import brief" }).click();
  await expect(p.getByRole("alert")).toBeVisible({ timeout: 30_000 });
  await p.getByRole("button", { name: "Remove image" }).click();
  await expect(p.getByRole("img", { name: "Preview of the chosen challenge image" })).toHaveCount(0);

  // --- Text import, by keyboard: proposals to review, the unquoted one only as uncertain.
  await fixture("sponsor-challenge-requirements", PROPOSAL);
  await p.getByLabel("Challenge text").fill(BRIEF);
  await p.getByLabel(/^Title/).fill("Acme Maps");
  await p.getByRole("button", { name: "Import brief" }).focus();
  await page.keyboard.press("Enter");
  const review = p.getByLabel("Review requirements");
  await expect(review).toBeVisible({ timeout: 60_000 });
  await expect(review.getByLabel(/^Transcript/)).toHaveValue(BRIEF);
  await expect(review.getByLabel("Quote from the transcript")).toHaveCount(2);
  await expect(review).toContainText("Could be 2 or 3 minutes");

  // Add the missing deliverable, first misquoted (flagged in words), then fixed.
  await review.getByRole("button", { name: "Add requirement" }).click();
  const quotes = review.getByLabel("Quote from the transcript");
  await review.getByLabel("Kind").nth(2).selectOption("deliverable");
  await quotes.nth(2).fill("Submit a video");
  await expect(review).toContainText("Not found in the transcript");
  await review.getByRole("button", { name: "Confirm requirements" }).click();
  await expect(p.getByRole("alert")).toContainText("quote text that appears in the transcript");
  await quotes.nth(2).fill("Submit a 2-minute demo video.");
  await review.getByRole("button", { name: "Confirm requirements" }).click();
  await expect(p).toContainText("Confirmed revision 1", { timeout: 30_000 });

  // --- Assess the saved idea with one evidence note.
  const challengeId = await p.getByRole("article", { name: "Challenge" }).getAttribute("data-challenge-id");
  const detail = await (await page.request.get(`/api/sponsor-challenges/${challengeId}`)).json();
  const rev = detail.revisions[0];
  const cite = (sourceId: string, quote: string) => ({ sourceId, quote });
  const model = (points: (number | null)[]) => ({
    requirements: [
      { requirementId: "r1", status: "met", reasons: [{ text: "Undergraduate team", label: "supported", citations: [cite("e1", "four undergraduates")] }], missingProof: null, nextCheck: "Confirm enrolment" },
      { requirementId: "r2", status: "met", reasons: [{ text: "The idea plans to use the API", label: "inferred", citations: [cite(idea.versionId, "Uses the Acme Maps API")] }], missingProof: null, nextCheck: "Show a working call" },
      { requirementId: "r3", status: "unknown", reasons: [], missingProof: "A recorded demo video", nextCheck: "Record the video" },
    ],
    whyFits: [{ text: "It serves university students, as the brief asks", label: "supported", citations: [cite(idea.versionId, "University students"), cite(rev.revisionId, "Teams must be university students.")] }],
    whyNot: [{ text: "You will likely win the Acme prize", label: "inferred", citations: [] }],
    stillUnknown: [{ text: "Whether the demo video will exist", label: "unverified", citations: [] }],
    // An estimate stands only on its brief anchor and a cited idea or evidence passage (rubric.ts).
    criteria: [
      { criterionId: "c1", points: points[0], anchorQuote: points[0] === null ? null : "5 = partly shown", reason: { text: "Routes are a known idea", label: "inferred", citations: [cite(idea.versionId, "plan walking routes")] } },
      { criterionId: "c2", points: points[1], anchorQuote: points[1] === null ? null : "10 = fully shown", reason: { text: "Students need it", label: "inferred", citations: [cite(idea.versionId, "Getting lost between classes")] } },
    ],
  });
  await fixture("sponsor-challenge-assess", model([5, 10]));
  const assess = p.getByLabel("Assess fit");
  await assess.getByLabel("Saved idea").selectOption(idea.versionId);
  await assess.getByRole("button", { name: "Add evidence note" }).click();
  await assess.getByLabel("Note 1").fill("Our team: four undergraduates at UCF.");
  await assess.getByRole("button", { name: "Assess fit" }).click();
  const result = p.getByRole("article", { name: "Assessment" });
  await expect(result).toBeVisible({ timeout: 60_000 });
  const shown = await (await page.request.get(`/api/sponsor-challenges/${challengeId}/assessments/${await result.getAttribute("data-assessment-id")}`)).json();

  // What the API decided is what the page says: eligibility, counts, statuses, basis, missing proof, total.
  await expect(result).toContainText("Brief revision 1");
  await expect(result).toContainText(`Requirements: ${shown.counts.met} met, ${shown.counts.notMet} not met, ${shown.counts.unknown} unknown.`);
  expect(shown.eligibility).toBe("met");
  await expect(result).toContainText("Eligibility: every condition is met by your evidence.");
  await expect(result.getByRole("region", { name: "Why it fits" })).toContainText("It serves university students");
  await expect(result.getByRole("region", { name: "Why it fits" })).toContainText("supported");
  await result.getByRole("region", { name: "Why it fits" }).getByText("Sources (2)").click();
  await expect(result.getByRole("region", { name: "Why it fits" })).toContainText("Teams must be university students.");
  await expect(result.getByRole("region", { name: "Requirement checks" })).toContainText("Missing proof: A recorded demo video");
  await expect(result.getByRole("region", { name: "Requirement checks" })).toContainText("based on your evidence");
  expect(shown.rubricEstimate.total).not.toBeNull();
  await expect(result.getByRole("region", { name: "Estimated rubric score" })).toContainText(`Estimated total: ${shown.rubricEstimate.total} of ${shown.rubricEstimate.maximum}`);
  await expect(result.getByRole("region", { name: "Estimated rubric score" })).toContainText("5 = partly shown");
  // No winning prediction survives, and the page says what the score is not.
  await expect(result).not.toContainText("likely win");
  await expect(result).toContainText("not a judge's score or a chance of winning");
  await expect(result).toContainText("user-supplied and were not tested");
  await page.screenshot({ path: info.outputPath("desktop.png"), fullPage: true });

  // --- Reload: the saved assessment comes back.
  await page.reload();
  await toDecide(page);
  await p.getByRole("button", { name: /^Acme Maps · revision 1/ }).click();
  await expect(p.getByRole("article", { name: "Assessment" })).toContainText("It serves university students", { timeout: 30_000 });

  // --- A missing estimate: no total, and the reason said.
  await fixture("sponsor-challenge-assess", model([5, null]));
  await p.getByRole("button", { name: "Reassess" }).click();
  await expect(p.getByRole("region", { name: "Estimated rubric score" })).toContainText("No total", { timeout: 60_000 });

  // --- Provider failure: the failure is said, the inputs are kept, and retry works.
  await fixture("sponsor-challenge-assess", { not: "valid" });
  await assess.getByRole("button", { name: "Add evidence note" }).click();
  await assess.getByLabel("Note 1").fill("Our team: four undergraduates at UCF. Updated.");
  await p.getByRole("button", { name: "Reassess" }).click();
  await expect(p.getByText(/The assessment failed/)).toBeVisible({ timeout: 60_000 });
  await expect(assess.getByLabel("Note 1")).toHaveValue("Our team: four undergraduates at UCF. Updated.");
  await fixture("sponsor-challenge-assess", model([5, 10]));
  await p.getByRole("button", { name: "Retry" }).click();
  await expect(p.getByRole("article", { name: "Assessment" })).toBeVisible({ timeout: 60_000 });

  // --- A corrected brief is revision 2; the earlier assessments say they used an older revision.
  await p.getByRole("button", { name: "Correct the brief" }).click();
  await review.getByLabel("Summary (optional)").nth(1).fill("Must call the Acme Maps API");
  await review.getByRole("button", { name: "Confirm requirements" }).click();
  await expect(p).toContainText("Confirmed revision 2", { timeout: 30_000 });
  await p.getByText(/Earlier assessments/).click();
  await expect(p.getByRole("button", { name: /revision 1 \(older revision\)/ }).first()).toBeVisible();

  // --- Another workspace sees none of it.
  const stranger = await browser.newContext();
  const other = await stranger.newPage();
  await other.goto("/");
  expect((await other.request.post("/api/workspace", { headers: { origin } })).ok()).toBe(true);
  expect((await (await other.request.get("/api/sponsor-challenges")).json()).challenges).toEqual([]);
  expect((await other.request.get(`/api/sponsor-challenges/${challengeId}`)).status()).toBe(404);
  // The public share route never asks for sponsor data.
  const asked: string[] = [];
  other.on("request", (r) => r.url().includes("/api/sponsor-challenges") && asked.push(r.url()));
  await other.goto(`/s/${randomUUID()}`);
  await other.waitForLoadState("networkidle");
  expect(asked).toEqual([]);
  await stranger.close();

  // --- Phone width: the section fits with no sideways scroll.
  await page.setViewportSize({ width: 390, height: 844 });
  await toDecide(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await panel(page).getByRole("heading", { name: "Sponsor challenges" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("phone.png") });
  await page.setViewportSize({ width: 1280, height: 900 });

  // --- Delete: two steps, then gone everywhere.
  await toDecide(page);
  await p.getByRole("button", { name: "Delete", exact: true }).click();
  await p.getByRole("button", { name: "Delete the brief and its assessments" }).click();
  await expect(p.getByRole("article", { name: "Challenge" })).toHaveCount(0);
  expect((await page.request.get(`/api/sponsor-challenges/${challengeId}`)).status()).toBe(404);
  await rm(join(fixtures!, "sponsor-challenge-assess.json"), { force: true });
});
