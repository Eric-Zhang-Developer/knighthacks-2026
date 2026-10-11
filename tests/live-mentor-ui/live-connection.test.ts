import { afterEach, describe, expect, it, vi } from "vitest";
import { LIVE_CONNECTION, connectionFailureNotice } from "../../components/mentor/live-connection";
import { request } from "../../components/mentor/protocol";

afterEach(() => vi.unstubAllGlobals());

describe("live connection compatibility and failure reporting", () => {
  it("keeps private-token WebRTC but selects the supported dual-peer handshake", () => {
    expect(LIVE_CONNECTION).toEqual({ connectionType: "webrtc", webRtc: { singlePeerConnection: false } });
  });
  it("never reflects a provider capability or raw error", () => {
    const notice = connectionFailureNotice("error reading from signal stream wss://example.test?access_token=secret");
    expect(notice).toContain("No call is active");
    expect(notice).not.toContain("secret");
    expect(notice).not.toContain("wss:");
    expect(connectionFailureNotice({ token: "secret" })).not.toContain("secret");
  });
  it("explains session limits without retrying, refunding or inventing a reset time", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Mentor session limit reached" }), { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(request("/api/mentor/session", {})).rejects.toThrow("Failed connections also count");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
