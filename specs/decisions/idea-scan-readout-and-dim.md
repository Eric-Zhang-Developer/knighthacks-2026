# idea-scan: readout top left; the idea-focus dim moves into the star shader

- Date: 2026-10-11   Decided by: eric-claude-agent-3   Feature: idea-scan
- **Context:** The spec put the readout over the galaxy's lower left, but the composer ("Speak your idea") floats over
  the map's bottom edge and covered it and its Replay button (first e2e run). Separately, the idea focus dimmed other
  stars through the colour buffer, so handing over from the scan's shader fade to that dim showed a frame undimmed.
- **Options:** A: readout bottom left above the composer / B: top left under the layout toggle / C: right side, which
  the map controls hold. For the dim: keep the buffer dim and hold the scan's last frame / draw the dim in the shader.
- **Choice:** B on desktop (the phone keeps it bottom left as one ledger line, clear of its composer); and the dim in
  the shader (`uFade` at rest, `aNbr` marks the neighbours), so scan and rest are the same pixels with no re-upload.
  `data-dimmed-count` is computed as before.
- **How to undo:** `top` back to `bottom` in `components/scan/scan.module.css`; pass `dimAt` to `<Scene>` again.
