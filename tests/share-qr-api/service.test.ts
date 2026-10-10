import { beforeEach, expect, test, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("next/dist/compiled/server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: () => ({ execute }) }));
import { newToken, hashToken, validToken } from "@/lib/shares/tokens";
import { createShare, readShare, revokeShare } from "@/lib/shares/service";
beforeEach(() => vi.resetAllMocks());
test("tokens contain 128 random bits and only canonical base64url encodings pass", () => {
  const a = newToken(), b = newToken();
  expect(validToken(a)).toBe(true); expect(Buffer.from(a, "base64url").length).toBe(16); expect(a === b).toBe(false);
  expect(hashToken(a).length).toBe(64); expect(hashToken(a) === a).toBe(false);
  for (const invalid of ["", "a".repeat(21), "a".repeat(23), "A".repeat(21) + "B", "A".repeat(22) + "==", "../token"]) expect(validToken(invalid)).toBe(false);
});
test("create binds snapshot ownership and sends only a digest to the database", async () => {
  execute.mockResolvedValue({ rows: [{ snapshot_id: "snapshot" }] });
  const token = await createShare("workspace", "snapshot");
  const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
  expect(query.params.includes(token)).toBe(false); expect(query.params[0] === hashToken(token)).toBe(true);
  expect(query.params.slice(1)).toEqual(["snapshot", "workspace"]);
  expect(query.sql).toContain('s."workspace_id" =');
});
test("unknown or foreign snapshot cannot create a usable share", async () => {
  execute.mockResolvedValue({ rows: [] });
  await expect(createShare("other", "snapshot")).rejects.toMatchObject({ status: 404 });
});
test("public read returns exact frozen data and rejects malformed tokens before querying", async () => {
  const token = newToken(), data = { title: "Frozen snapshot", privateNotes: undefined };
  execute.mockResolvedValueOnce({ rows: [{ revokedAt: null, data }] });
  expect(await readShare(token)).toEqual(data); expect(execute).toHaveBeenCalledTimes(1);
  await expect(readShare("invalid")).rejects.toMatchObject({ status: 404 }); expect(execute).toHaveBeenCalledTimes(1);
  const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
  expect(query.params[0] === hashToken(token)).toBe(true); expect(query.params.includes(token)).toBe(false);
});
test("revoked/unknown reads expose no data, revoke scope is atomic and repeat-safe", async () => {
  const token = newToken();
  execute.mockResolvedValueOnce({ rows: [{ revokedAt: "2026-10-10T00:00:00Z", data: null }] });
  await expect(readShare(token)).rejects.toMatchObject({ status: 410, message: "revoked" });
  execute.mockResolvedValueOnce({ rows: [] });
  await expect(readShare(token)).rejects.toMatchObject({ status: 404 });
  execute.mockResolvedValue({ rows: [{ snapshot_id: "snapshot" }] });
  await revokeShare("workspace", token); await revokeShare("workspace", token);
  const query = new PgDialect().sqlToQuery(execute.mock.calls[2][0]);
  expect(query.params[0] === hashToken(token)).toBe(true); expect(query.params[1]).toBe("workspace");
  expect(query.sql).toContain('coalesce(s."revoked_at", now())');
  execute.mockResolvedValueOnce({ rows: [] });
  await expect(revokeShare("foreign", token)).rejects.toMatchObject({ status: 404 });
});
