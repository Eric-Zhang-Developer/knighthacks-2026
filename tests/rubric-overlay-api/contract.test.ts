import { readFileSync } from "node:fs";
import { expect, test, vi } from "vitest";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
vi.mock("next/dist/compiled/server-only", () => ({}));
import { tracks, generatedSchema, normalize, proofSchema } from "@/lib/rubric/contract";
const versionId = "00000000-0000-4000-8000-000000000001";
const output = () => ({ tracks: tracks.map((track) => ({ trackId: track.id, stated: [] as { text: string; label: "supported"; sourceIds: string[] }[], speculative: [] as { text: string; label: "supported"; sourceIds: string[] }[] })) });
test("catalog exactly transcribes every prizes table row including absent requirements", () => {
  const rows: { name: string; rewards: string | null; source: string }[] = [];
  let header: string[] = [];
  for (const line of readFileSync("specs/context/prizes.md", "utf8").split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const cells = line.slice(1, -1).split("|").map((cell) => cell.trim());
    if (cells[0] === "Track") { header = cells; continue; }
    if (cells.every((cell) => /^[-:]+$/.test(cell))) continue;
    const index = header.indexOf("What it rewards");
    rows.push({ name: cells[0], rewards: index < 0 ? null : cells[index], source: "specs/context/prizes.md" });
  }
  expect(tracks.map(({ name, rewards, source }) => ({ name, rewards, source }))).toEqual(rows);
  expect(tracks).toHaveLength(28); expect(new Set(tracks.map((track) => track.id)).size).toBe(28);
  expect(tracks.every((track) => /^[a-z0-9-]+$/.test(track.id))).toBe(true);
});
test("real quotes cite version intent; nonquotes and foreign speculation cannot become proof", () => {
  const generated = output();
  generated.tracks[0].stated = [{ text: "Use 36 hours", label: "supported", sourceIds: ["invented"] }];
  generated.tracks[1].stated = [{ text: "A deployed integration exists", label: "supported", sourceIds: [versionId] }];
  generated.tracks[2].speculative = [{ text: "This may fit the track", label: "supported", sourceIds: ["foreign"] }];
  const normalized = normalize(versionId, ["Use 36 hours to build a prototype"], generated);
  expect(normalized.tracks[0].stated[0]).toEqual({ text: "Use 36 hours", label: "supported", sourceIds: [versionId] });
  expect(normalized.tracks[1]).toMatchObject({ stated: [], speculative: [{ label: "unverified", sourceIds: [] }], proof: null });
  expect(normalized.tracks[2].speculative[0]).toMatchObject({ label: "unverified", sourceIds: [] });
  expect(normalized.tracks.map((track) => track.requirement)).toEqual(tracks.map((track) => track.rewards));
});
test("bounded schema supports both providers and factual digits, but rejects scores and missing/duplicate tracks", () => {
  const schema = generatedSchema(["Use 36 hours to build a prototype", "The user states a 90% target, which is unverified intent"]);
  expect(z.toJSONSchema(schema)).toHaveProperty("properties.tracks"); expect(zodOutputFormat(schema)).toHaveProperty("type", "json_schema");
  const generated = output(); generated.tracks[0].stated = [{ text: "Use 36 hours", label: "supported", sourceIds: [versionId] }];
  expect(schema.safeParse(generated).success).toBe(true);
  generated.tracks[0].stated[0].text = "90% target"; expect(schema.safeParse(generated).success).toBe(true);
  for (const text of ["A score of 36", "Ranked first", "90% chance of winning", "Likely to win", "Needs 987654 users"]) {
    generated.tracks[0].stated[0].text = text; expect(schema.safeParse(generated).success, text).toBe(false);
  }
  expect(schema.safeParse({ tracks: output().tracks.slice(1) }).success).toBe(false);
  const duplicate = output(); duplicate.tracks[0] = duplicate.tracks[1]; expect(schema.safeParse(duplicate).success).toBe(false);
  expect(schema.safeParse({ ...output(), score: 5 }).success).toBe(false);
});
test("proof is bounded explicit user input and cannot update generated fields", () => {
  expect(proofSchema.parse({ proof: " https://example.test/demo " }).proof).toBe("https://example.test/demo");
  expect(proofSchema.parse({ proof: null }).proof).toBeNull();
  for (const value of [{ proof: "" }, { proof: "x".repeat(4001) }, { proof: "note", stated: [] }]) expect(proofSchema.safeParse(value).success).toBe(false);
});


test("catalog digits cannot ground invented quantities outside copied source spans", () => {
  const schema = generatedSchema([]), generated = output();
  const entry = { text: "", label: "supported" as const, sourceIds: [] as string[] };
  generated.tracks[0].speculative = [entry];
  for (const text of ["There are 36 confirmed users", 'The track says "36 hours" but there are 36 users', 'The idea has "36 confirmed users"']) {
    entry.text = text; expect(schema.safeParse(generated).success, text).toBe(false);
  }
  for (const text of ["36 hours", 'The track says "36 hours"; implementation remains unverified', 'The track says “36 hours”; implementation remains unverified']) {
    entry.text = text; expect(schema.safeParse(generated).success, text).toBe(true);
  }
});
