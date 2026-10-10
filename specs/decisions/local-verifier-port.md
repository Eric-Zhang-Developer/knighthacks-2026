# Local verification port

Context: the default Playwright server port, 3100, is already used by an unrelated local service on Windows. The unchanged main branch fails before running bootstrap tests with `http://localhost:3100/api/health is already used`.

Choice: keep 3100 as the default and allow `UNCHARTED_VERIFY_PORT` to select another port for both the test server and browser base URL. Keep `reuseExistingServer: false`: verification must start this repository's build, never silently test an unrelated listener. Values outside the integer range 1–65535 fail immediately.

Run in PowerShell: `$env:UNCHARTED_VERIFY_PORT = '3111'`, then the normal verifier. Choose a free port and restore or remove the variable afterward. Undo by removing the override; the normal default is unchanged. Product behavior, feature scope, and dependencies are unchanged.
