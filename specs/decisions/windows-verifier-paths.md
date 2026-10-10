# Native Windows verification

The shared verifier is used from native Windows and macOS. Windows command arguments need native quoting; POSIX single quotes become literal characters in cmd.exe and can corrupt evidence paths. Keep POSIX behavior unchanged and retain actual verification failures.

Reproduction on the unchanged origin/main runner: guest-workspace verification on Windows generated a literal single-quoted evidence path and failed with ENOENT. A focused regression test must round-trip a Windows path with spaces through the real subprocess launcher.
