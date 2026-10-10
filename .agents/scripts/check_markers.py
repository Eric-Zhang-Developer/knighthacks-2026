#!/usr/bin/env python3
"""Block git conflict markers and debug leftovers. Runs in the pre-commit hook (humans too) and in CI.

  check_markers.py --staged          lines added in the staged diff (pre-commit)
  check_markers.py --base origin/main   lines added since the merge base (CI)
  check_markers.py --all             every tracked text file (audits, examples)

A line containing `markers: allow` is skipped. Patterns: .agents/config.toml [markers].
"""

import re
import sys
from pathlib import Path

from lib import as_list, git, load_config, parser, root_from

CONFLICT = re.compile(r"^(<{7} |={7}$|>{7} )")


def scan_line(line: str, debug: list[re.Pattern]) -> str | None:
    if "markers: allow" in line:
        return None
    if CONFLICT.match(line.rstrip("\r\n")):
        return "conflict marker"
    for p in debug:
        if p.search(line):
            return f"debug leftover ({p.pattern})"
    return None


def added_lines(diff: str):
    """Yield (path, line_no, text) for every added line in a unified diff (-U0)."""
    path, line_no = None, 0
    for raw in diff.splitlines():
        if raw.startswith("+++ "):
            path = raw[6:] if raw.startswith("+++ b/") else None
        elif raw.startswith("@@"):
            m = re.search(r"\+(\d+)", raw)
            line_no = int(m.group(1)) if m else 0
        elif raw.startswith("+") and path:
            yield path, line_no, raw[1:]
            line_no += 1


def all_lines(root: Path):
    for rel in git(root, "ls-files", "-z").split("\0"):
        p = root / rel
        if not rel or not p.is_file():
            continue
        data = p.read_bytes()
        if b"\0" in data[:8192]:
            continue  # binary
        for i, line in enumerate(data.decode("utf-8", errors="replace").splitlines(), 1):
            yield rel, i, line


def main(argv=None) -> int:
    ap = parser(__doc__)
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--staged", action="store_true", help="scan lines added in the staged diff")
    mode.add_argument("--base", help="scan lines added since the merge base with this ref")
    mode.add_argument("--all", action="store_true", help="scan every tracked text file")
    args = ap.parse_args(argv)
    root = root_from(args)
    cfg = load_config(root)
    debug = [re.compile(p) for p in as_list(cfg["markers"]["debug_patterns"])]
    ignore = tuple(as_list(cfg["markers"]["ignore"]))

    if args.all:
        lines = all_lines(root)
    else:
        diff_args = ["diff", "--cached"] if args.staged else ["diff", f"{args.base}...HEAD"]
        # no --text: binaries show as "Binary files differ" and are skipped, the same as --all skips them
        lines = added_lines(git(root, *diff_args, "-U0", "--no-color", "--no-ext-diff"))

    findings = 0
    for path, n, text in lines:
        if ignore and path.startswith(ignore):
            continue
        kind = scan_line(text, debug)
        if kind:
            findings += 1
            print(f"{path}:{n}: {kind}: {text.strip()[:120]}")
    print(f"markers: {findings} finding(s), {'FAIL' if findings else 'ok'}")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
