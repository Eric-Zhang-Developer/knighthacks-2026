import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

test("the workspace starts once per page load, however often the boundary mounts", async () => {
  let calls = 0;
  vi.stubGlobal("fetch", async () => (calls++, Response.json({ workspaceId: "w", memberId: "m" }, { status: 201 })));
  const { initWorkspace } = await import("@/components/workspace/api");
  const [x, y] = await Promise.all([initWorkspace(), initWorkspace()]);
  await initWorkspace();
  expect(calls).toBe(1);
  expect(x).toEqual({ ok: true, data: { workspaceId: "w", memberId: "m" } });
  expect(y).toBe(x);
});

test("a failed start can be retried", async () => {
  let calls = 0;
  vi.stubGlobal("fetch", async () =>
    ++calls === 1 ? Response.json({ error: "Workspace service unavailable" }, { status: 503 }) : Response.json({ workspaceId: "w", memberId: "m" }),
  );
  const { initWorkspace } = await import("@/components/workspace/api");
  expect(await initWorkspace()).toEqual({ ok: false, status: 503, error: "Workspace service unavailable" });
  expect((await initWorkspace()).ok).toBe(true);
  expect(calls).toBe(2);
});
