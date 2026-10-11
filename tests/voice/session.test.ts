import { expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { WorkspaceError } from "@/lib/workspace/tokens";

const mint = vi.fn().mockResolvedValue("single-use-token");
vi.mock("@/lib/voice/token", () => ({ mintScribeToken: mint }));
vi.mock("@/lib/workspace/require", () => ({
  requireWorkspace: vi.fn().mockRejectedValue(new WorkspaceError(401, "Guest session required")),
}));
const { POST } = await import("@/app/api/voice/token/route");

test("missing workspace session returns 401 without spending a provider token", async () => {
  const request = new NextRequest("https://uncharted.test/api/voice/token", {
    method: "POST", headers: { origin: "https://uncharted.test" },
  });
  const response = await POST(request);
  expect(response.status).toBe(401);
  expect(mint).not.toHaveBeenCalled();
});
