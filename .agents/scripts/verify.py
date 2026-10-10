#!/usr/bin/env python3
"""Run the project's verifier, so an agent sees its own change running instead of a person checking it by hand.

  verify.py --slug map-data [--worktree PATH]

Runs [verify].command from .agents/config.toml in the worktree, shows its output, then prints one result line. Put
that line under `## How to check it` in the done note:
  verify: `<command>` pass at <sha> (evidence: <dir>)
  verify: `<command>` FAIL (exit N) at <sha>
  verify: not set up ([verify].command is empty); the done note says `not verified`
Placeholders: {slug}, {worktree}, and {out}, a fresh evidence folder for this run (screenshots, responses, logs)
outside the repo's files, kept after the run. Everything the command started is stopped when it ends or times out
([verify].timeout seconds), so a server it launched can't leak into the next run.
Exit codes: 0 pass or not set up, 1 fail, timeout or a broken command template, 2 usage.
"""

import os
import shlex
import signal
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from lib import git, heartbeat_dir, load_config, parser, root_from, slug_error


def evidence_dir(root: Path, slug: str) -> Path:
    """<git common dir>/agent-evidence/<slug>/<UTC time>: shared by every worktree, never committed."""
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return heartbeat_dir(root).parent / "agent-evidence" / slug / stamp


def run(command: str, cwd: Path, timeout: float) -> int | None:
    """Exit code, or None on timeout. The command gets its own process group, which is stopped afterwards."""
    posix = hasattr(os, "killpg")
    p = subprocess.Popen(command, shell=True, cwd=cwd, start_new_session=posix)
    try:
        rc = p.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        rc = None
    if posix:  # stop anything it left running in the background (a dev server, a browser)
        try:
            os.killpg(p.pid, signal.SIGTERM)
        except (ProcessLookupError, PermissionError):
            pass
    elif rc is None:
        p.kill()
    p.wait()
    return rc


def main(argv=None) -> int:
    ap = parser(__doc__)
    ap.add_argument("--slug", required=True, help="the feature being verified")
    ap.add_argument("--worktree", help="where to run it (default: the repo root)")
    args = ap.parse_args(argv)
    if err := slug_error(args.slug):
        print(f"verify: --slug {args.slug!r}: {err}")
        return 2
    root = root_from(args)
    cfg = load_config(root)["verify"]
    template = str(cfg["command"]).strip()
    if not template:
        print("verify: not set up ([verify].command is empty); the done note says `not verified`")
        return 0
    worktree = Path(args.worktree).resolve() if args.worktree else root
    out = evidence_dir(root, args.slug) if "{out}" in template else None
    try:
        command = template.format(slug=args.slug, worktree=shlex.quote(str(worktree)),
                                  out=shlex.quote(str(out)) if out else "")
    except (KeyError, IndexError, ValueError) as e:
        print(f"verify: [verify].command has a bad placeholder ({e}); use only {{slug}}, {{worktree}} and {{out}}")
        return 1
    if out:
        out.mkdir(parents=True, exist_ok=True)
    sha = git(worktree, "rev-parse", "--short", "HEAD", check=False).strip() or "unknown commit"
    dirty = " (uncommitted changes)" if git(worktree, "status", "--porcelain", check=False).strip() else ""
    sys.stdout.flush()
    rc = run(command, worktree, float(cfg["timeout"]))
    result = "pass" if rc == 0 else f"FAIL (timed out after {cfg['timeout']}s)" if rc is None else f"FAIL (exit {rc})"
    kept = f" (evidence: {out})" if out else ""
    print(f"verify: `{command}` {result} at {sha}{dirty}{kept}")
    return 0 if rc == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
