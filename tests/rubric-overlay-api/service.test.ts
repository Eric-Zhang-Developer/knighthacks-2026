import { beforeEach, expect, test, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const { execute, generate } = vi.hoisted(() => ({ execute: vi.fn(), generate: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: () => ({ execute }) }));
vi.mock("@/lib/ai/generate", () => ({ generate }));
import { createOverlay, getOverlay, patchProof } from "@/lib/rubric/service";
import { tracks, normalize } from "@/lib/rubric/contract";
const version = { title: "Use 36 hours", workflow: "Build a prototype", audience: null };
const output = { tracks: tracks.map((track) => ({ trackId: track.id, stated: [], speculative: [] })) };
const saved = normalize("version", [], output);
const rows = (values: unknown[]) => ({ rows: values });
beforeEach(() => { vi.resetAllMocks(); generate.mockResolvedValue(output); });
test("foreign workspace cannot generate, read cached overlay, or attach proof", async () => {
  execute.mockResolvedValue(rows([]));
  await expect(createOverlay("foreign", "version")).rejects.toMatchObject({ status: 404 });
  expect(execute).toHaveBeenCalledTimes(1); expect(generate).not.toHaveBeenCalled();
  await expect(getOverlay("foreign", "version")).rejects.toMatchObject({ status: 404 });
  await expect(patchProof("foreign", "version", tracks[0].id, "note")).rejects.toMatchObject({ status: 404 });
});
test("cached POST preserves attached proof and does not generate", async () => {
  execute.mockResolvedValueOnce(rows([version])).mockResolvedValueOnce(rows([{ data: saved, proofs: { [tracks[0].id]: "Proof note" } }]));
  const result = await createOverlay("workspace", "version");
  expect(result.tracks[0].proof).toBe("Proof note"); expect(generate).not.toHaveBeenCalled(); expect(execute).toHaveBeenCalledTimes(2);
});
test("concurrent initial loser returns winner plus current proof via fresh scoped read", async () => {
  const winner = { ...saved, tracks: saved.tracks.map((track, index) => ({ ...track, speculative: index ? [] : [{ text: "Winner text", label: "inferred", sourceIds: [] }] })) };
  execute.mockResolvedValueOnce(rows([version])).mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([])).mockResolvedValueOnce(rows([{ data: winner, proofs: { [tracks[0].id]: "Attached during generation" } }]));
  const result = await createOverlay("workspace", "version");
  expect(result.tracks[0]).toMatchObject({ speculative: [{ text: "Winner text" }], proof: "Attached during generation" });
  expect(generate.mock.calls[0][0].prompt.stubKey).toBe("rubric-overlay");
  const query = new PgDialect().sqlToQuery(execute.mock.calls[2][0]);
  expect(query.sql).toContain('on conflict ("version_id") do nothing');
  expect(query.sql).not.toContain('rubric_proofs');
  expect(new PgDialect().sqlToQuery(execute.mock.calls[3][0]).params).toEqual(["version", "workspace"]);
});
test("provider rejection never writes and has a safe error", async () => {
  execute.mockResolvedValueOnce(rows([version])).mockResolvedValueOnce(rows([])); generate.mockRejectedValue(new Error("secret provider detail"));
  await expect(createOverlay("workspace", "version")).rejects.toMatchObject({ status: 502, message: "Rubric generation is temporarily unavailable. Please retry." });
  expect(execute).toHaveBeenCalledTimes(2);
});
test("proof upsert touches only its track and returns stored overlay; null clears", async () => {
  execute.mockResolvedValueOnce(rows([{ version_id: "version" }])).mockResolvedValueOnce(rows([{ data: saved, proofs: { [tracks[1].id]: "Other track proof" } }]));
  const result = await patchProof("workspace", "version", tracks[0].id, null);
  expect(result.tracks[0].proof).toBeNull(); expect(result.tracks[1].proof).toBe("Other track proof");
  const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
  expect(query.params).toEqual([tracks[0].id, null, "version", "workspace"]);
  expect(query.sql).not.toMatch(/update[\s\S]*"data"/); expect(generate).not.toHaveBeenCalled();
});
test("unknown track fails before database access", async () => {
  await expect(patchProof("workspace", "version", "invented-track", "note")).rejects.toMatchObject({ status: 404 }); expect(execute).not.toHaveBeenCalled();
});

