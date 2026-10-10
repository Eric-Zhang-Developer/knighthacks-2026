# Explicit fixtures for a local production verifier

The canonical verifier starts `next build && next start`, so its app process has
`NODE_ENV=production`. The original test-only fixture guard rejects that process,
although the AI client contract permits fixtures in tests and the verifier (#104).

Keep `AI_STUB_DIR` and require the additional server-only `AI_STUB_ALLOW=1` opt-in
outside `NODE_ENV=test`. Any truthy `VERCEL` still rejects fixtures, even with the
flag. Invalid or unavailable fixtures return `STUB_UNAVAILABLE`; they never fall
through to a live provider. Fixture path, size and schema checks remain in force.

Feature verification must set both variables before starting its app process, for
example `AI_STUB_DIR=/absolute/test/fixtures AI_STUB_ALLOW=1 python3 .agents/scripts/verify.py --slug <feature> --worktree .`.
The shared verifier does not automatically enable fixtures. Do not configure these
variables on a deployed app; the demo-flow feature continues to require live models.
Unsetting the two fixture variables restores normal provider selection.

The production regression test builds a temporary Next app importing the actual
server-only AI module and checks opt-in success, rejection without the flag and
rejection on Vercel over HTTP. It retains only sanitized fixture observations.
