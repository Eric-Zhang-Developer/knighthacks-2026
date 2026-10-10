# Tech stack

<!-- Pin choices before the run; new dependencies only through a `contract:` PR. -->

| Layer | Choice |
|---|---|
| Language / framework | |
| Data / database | <!-- a one-way door: choose deliberately; load-test the free tier before you demo on it --> |
| Hosting | |
| Tests | <!-- include a golden test built from a known worked example --> |

## Layout
<!-- The folders the bootstrap feature creates, marking which are frozen. Feature `owns` entries refer to these. -->
```
```

## Checks (run before marking a PR ready)
<!-- Keep CI under ~5 minutes: a slow CI caps how fast every agent can merge. Docs-only changes can skip heavy jobs. -->
```bash
python3 .agents/scripts/check_ownership.py --lint-specs
python3 .agents/scripts/check_ownership.py --title "<PR title>" --base origin/main
python3 .agents/scripts/check_gates.py --title "<PR title>" --base origin/main
python3 .agents/scripts/check_markers.py --base origin/main
# your tests here
```

## Verify (see your change running)
<!-- The bootstrap feature sets [verify].command in .agents/config.toml: one deterministic command that runs the
software and shows the result (a CLI smoke run, a headless-browser script, an HTTP check against a local server).
Not just unit tests. Agents run it as `python3 .agents/scripts/verify.py --slug <slug> --worktree .` and paste its
last line into the done note. -->
