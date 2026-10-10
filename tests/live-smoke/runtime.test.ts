import { spawn } from "node:child_process";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { versionSchema, directions } from "./shapes";
import { stopServer } from "./server";

describe("actual HTTP presentation contracts", () => {
  it("accepts saved-version metadata without allowing arbitrary extra fields", () => {
    const saved = { versionId: "00000000-0000-4000-8000-000000000001", ideaId: "00000000-0000-4000-8000-000000000002", parentId: null,
      title: "Test idea", description: null, audience: null, problem: null, workflow: "Choose a meal", constraints: null,
      corpusVersion: "test", createdAt: "2026-10-10T00:00:00.000Z", neighborIds: ["a", "b", "c", "d", "e"], x: 0, y: 0, z: 0 };
    expect(versionSchema.parse(saved)).toEqual(saved);
    expect(() => versionSchema.parse({ ...saved, unexpected: true })).toThrow();
  });
  it("accepts the public branch direction which intentionally omits field", () => {
    expect(directions.parse({ directions: [{ id: "00000000-0000-4000-8000-000000000001", title: "Test direction", change: "Choose food already present" }] }).directions).toHaveLength(1);
  });
  it("stops an owned child, including signal exit, and allows repeated cleanup", async () => {
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { windowsHide: true, stdio: "ignore" });
    try {
      await once(child, "spawn");
      await stopServer(child);
      expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
      await stopServer(child);
    } finally { if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); }
  });
});

