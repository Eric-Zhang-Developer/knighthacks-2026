import { expect, test, vi } from "vitest";
const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@/lib/ai/generate", () => ({ generate }));
vi.mock("@/lib/db", () => ({ db: () => { throw new Error("Interpret must not access the database"); } }));
import { interpret } from "@/lib/ideas/interpret";

test("interpret uses shared schema generation and never persists", async () => {
  const fields = { title: "Idea", description: null, audience: null, problem: null, workflow: null, constraints: null };
  generate.mockResolvedValueOnce(fields);
  expect(await interpret("A quoted \"idea\"")).toEqual(fields);
  const { prompt, schema } = generate.mock.calls[0][0];
  expect(prompt.stubKey).toBe("idea-interpret"); expect(prompt.text).toContain(JSON.stringify('A quoted "idea"'));
  expect(schema.safeParse(fields).success).toBe(true);
  expect(schema.safeParse({ ...fields, unknown: "invented" }).success).toBe(false);
  generate.mockRejectedValueOnce(new Error("provider secret response"));
  await expect(interpret("Idea")).rejects.toMatchObject({ status: 502 });
  generate.mockRejectedValueOnce(new Error("provider secret response"));
  await expect(interpret("Idea")).rejects.not.toThrow(/secret|response/);
});
