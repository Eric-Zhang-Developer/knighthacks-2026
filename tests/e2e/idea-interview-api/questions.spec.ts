import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

// Real session, interpret and questions routes; generation reads fixtures from AI_STUB_DIR (fresh, absolute,
// AI_STUB_ALLOW=1), written here per call. The route writes nothing to the database. Traces would hold session cookies.
test.use({ trace: "off" });
const vague = { title: null, description: "An app for students", audience: "Students", problem: null, workflow: null, constraints: null };
const ask = (field: string, question: string) => ({ field, question, why: `The answer decides the ${field} the build targets` });
const answer = (field: string, text: string) => ({ question: `About the ${field}?`, field, answer: text });
const everything = [answer("audience", "First-year engineering students"), answer("problem", "They miss lab sign-up windows"),
  answer("workflow", "Pick labs, get a reminder an hour before sign-up opens"), answer("constraints", "Must work on phones"),
  answer("data", "The public lab schedule page"), answer("demo", "Set a reminder and receive it live")];

test("vague idea -> questions about problem and workflow; full answers -> done; nine answers stop without a model call", async ({ playwright, baseURL }) => {
  test.setTimeout(120_000);
  const stub = process.env.AI_STUB_DIR;
  expect(Boolean(stub) && isAbsolute(stub!), "Start the server with a fresh absolute AI_STUB_DIR").toBe(true);
  const fixture = (key: string, body: unknown) => writeFile(join(stub!, `${key}.json`), JSON.stringify(body));
  const origin = new URL(baseURL!).origin, headers = { origin };
  const [owner, anonymous] = await Promise.all([0, 1].map(() => playwright.request.newContext({ baseURL: origin })));
  expect((await owner.post("/api/workspace", { headers })).status()).toBe(201);
  const questions = (data: unknown, c = owner) => c.post("/api/ideas/questions", { headers, data });

  // 1. "an app for students" -> interpret -> questions: problem and workflow at least, each with a why.
  await fixture("idea-interpret", vague);
  const interpreted = await owner.post("/api/ideas/interpret", { headers, data: { text: "an app for students" } });
  expect(interpreted.status()).toBe(200);
  const fields = await interpreted.json();
  // A fourth question and a duplicate field come back from the model; the server keeps one per field, at most three.
  await fixture("idea-questions-0", { done: false, questions: [ask("problem", "What goes wrong for students today?"),
    ask("problem", "Which problem first?"), ask("workflow", "What does a student do, step by step?"), ask("audience", "Which students?")] });
  const first = await questions({ fields, answers: [] });
  expect(first.status()).toBe(200);
  const body = await first.json();
  expect(Object.keys(body).sort()).toEqual(["done", "questions"]);
  expect(body.done).toBe(false);
  expect(body.questions.map((q: { field: string }) => q.field)).toEqual(["problem", "workflow", "audience"]);
  for (const q of body.questions) expect(q.why.length).toBeGreaterThan(0);

  // 2. Answers covering every field -> done, no questions (the model also listing one is dropped).
  await fixture(`idea-questions-${everything.length}`, { done: true, questions: [ask("demo", "Anything else?")] });
  const done = await questions({ fields, answers: everything });
  expect(await done.json()).toEqual({ questions: [], done: true });

  // Three rounds of answers: done with no model call (no idea-questions-9 fixture exists, so a call would 502).
  const nine = [...everything, ...everything.slice(0, 3)];
  expect(await (await questions({ fields, answers: nine })).json()).toEqual({ questions: [], done: true });

  // Provider failure (no fixture for this round) -> 502 {error}; bad bodies 400; no session 401; cross-origin 403.
  const failed = await questions({ fields, answers: everything.slice(0, 1) });
  expect(failed.status()).toBe(502);
  expect(Object.keys(await failed.json())).toEqual(["error"]);
  expect((await questions({ fields, answers: [answer("pricing", "Free")] })).status()).toBe(400);
  expect((await questions({ fields, answers: [...nine, nine[0]] })).status()).toBe(400);
  expect((await questions({ answers: [] })).status()).toBe(400);
  expect((await questions({ fields, answers: [] }, anonymous)).status()).toBe(401);
  expect((await owner.post("/api/ideas/questions", { headers: { origin: "https://evil.example" }, data: { fields, answers: [] } })).status()).toBe(403);
});
