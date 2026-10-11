// The installed SDK supports the dual-peer (v0) handshake directly. Avoid the
// newer single-peer signaling path; keep private-token WebRTC and native audio.
export const LIVE_CONNECTION = {
  connectionType: "webrtc",
  webRtc: { singlePeerConnection: false },
} as const;

export function connectionFailureNotice(message: unknown): string {
  // Never render raw provider errors: they may contain signed signaling URLs.
  if (typeof message === "string" && /signal|peer connection|websocket|network|fetch/i.test(message)) {
    return "The live audio connection could not reach ElevenLabs. No call is active. Avoid repeated retries; check your connection, VPN or firewall. You can keep typing.";
  }
  return "Live conversation could not start. No call is active. Your text conversation is still available.";
}
