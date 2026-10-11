# Live smoke

Run `python3 .agents/scripts/verify.py --slug live-smoke --worktree .` with the app's dedicated test `DATABASE_URL` equal to `TEST_DATABASE_URL`, real HF configuration, and at least one real provider key/model. Both fixture environment variables must be absent, even if empty. This harness does not load credentials or change environment files.

The canonical runner builds once. The test starts an additional isolated production Next process per configured key using that build, disabling the other provider explicitly so silent fallback cannot misattribute a pass. Provider passes run concurrently in separate workspaces/ports. A missing model or provider error is a failure, never a skipped provider. Readiness uses each child's unique verifier identity. No provider call is retried by this harness.

Each pass has a 320-second deadline and the Playwright test has 350 seconds including cleanup, leaving the canonical runner's build allowance within its 600-second budget. These are smoke-test limits, not latency promises. Real provider slowness can fail the run.

`claude.json` / `gemini.json` in the verifier evidence directory contain per-route response bodies, status, latency, pass identity, failure attribution, cleanup result, and unlabelled-field findings. Cookies, headers, raw provider/SQL exceptions, environment values, and HTTP traces are not saved. A detected credential echo causes the response body to be withheld. Evidence is synthetic user input passed through live models and real routes, never fixture-generated output.

Only a successful POST workspace identity is used for the parameterized cleanup DELETE; schema foreign-key cascades remove that workspace's dependent rows. No production tests are authorized. Cleanup failures fail the test and remain visible in evidence. No experiment is fabricated when the critic returns an outcome other than `test`; the actual outcome and omitted experiment are recorded.

Unit tests test the guard, citation validation, public response shapes, and owned-process shutdown only. They do not prove live provider, HTTP, or database acceptance. The live test itself contains no mock routes or fixtures.
