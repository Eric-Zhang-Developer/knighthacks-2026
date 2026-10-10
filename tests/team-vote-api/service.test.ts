import { beforeEach, expect, test, vi } from "vitest";
const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: () => ({ execute }) }));
import { readVotes } from "@/lib/votes/service";

const me = { workspaceId: "w", memberId: "a" };
const row = (memberId: string, versionId: string) =>
  ({ memberId, versionId, concern: null, changedAfterReveal: false, updatedAt: "2026-10-10T00:00:00Z" });
beforeEach(() => vi.resetAllMocks());

test("the teammate's vote never leaves the server before both have voted", async () => {
  execute.mockResolvedValue({ rows: [row("b", "v1")] });
  expect(await readVotes(me)).toEqual({ mine: null, theirs: null, revealed: false });
  execute.mockResolvedValue({ rows: [row("a", "v2")] });
  expect(await readVotes(me)).toMatchObject({ mine: { versionId: "v2" }, theirs: null, revealed: false });
});
test("both votes reveal with agreement", async () => {
  execute.mockResolvedValue({ rows: [row("a", "v1"), row("b", "v1")] });
  expect(await readVotes(me)).toMatchObject({ revealed: true, agreement: true, mine: { versionId: "v1" }, theirs: { versionId: "v1" } });
  execute.mockResolvedValue({ rows: [row("b", "v2"), row("a", "v1")] });
  expect(await readVotes(me)).toMatchObject({ revealed: true, agreement: false, mine: { versionId: "v1" }, theirs: { versionId: "v2" } });
});
