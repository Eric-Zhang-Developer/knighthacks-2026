import { beforeEach, expect, test, vi } from "vitest";

// A plain function, not vi.fn: vitest 5 reports a vi.fn's rejected result as a test failure even when the route
// catches it.
let rows: () => Promise<unknown[]>;
let calls = 0;
vi.mock("@/lib/db", () => ({
  db: () => ({ select: () => ({ from: () => ({ where: () => ({ limit: () => (calls++, rows()) }) }) }) }),
}));

const { GET } = await import("@/app/api/projects/[id]/route");
const ID = "5b95f4d2e24daee2aa04fb4d466f3f0fb3b796b2";
const get = (id: string) => GET(new Request(`http://x/api/projects/${id}`), { params: Promise.resolve({ id }) });

beforeEach(() => {
  calls = 0;
  rows = async () => [];
});

test("a known id returns its record", async () => {
  rows = async () => [{ id: ID, title: "DAVE", url: "https://devpost.com/software/dave" }];
  const res = await get(ID);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ id: ID, title: "DAVE", url: "https://devpost.com/software/dave" });
});

test("an unknown or malformed id is a 404 that never reaches the database", async () => {
  expect((await get(ID)).status).toBe(404);
  expect((await get("synthetic-center")).status).toBe(404);
  expect(calls).toBe(1);
});

test("a database failure is a 503", async () => {
  rows = async () => {
    throw new Error("db down");
  };
  expect((await get(ID)).status).toBe(503);
});
