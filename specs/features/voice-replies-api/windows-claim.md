# Windows claim

Worker: `kiro-agent-1`; Git author: Kiro. Issue #73.

Implement the accepted server-side speech spec using the pinned ElevenLabs SDK.
Windows owns `app/api/speech/` and the feature tests; Claude retains all frontend work.
`status.py` selects this as the first ready feature. The documented `cut` gate applies
during a milestone freeze; no core freeze is configured. No milestone rule is changed here.

The PR remains draft until its acceptance is verified. Windows currently has no
`ELEVENLABS_API_KEY` (tracked in #11); mocked provider tests will be labelled explicitly.
No production stub switch, new framework, or dependency is planned.
