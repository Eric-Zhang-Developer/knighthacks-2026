#!/usr/bin/env python3
"""Enforce milestone deadlines in CI, so a deadline is a rule instead of a suggestion. Warn on large PRs.

  check_gates.py --title "feat(map-data): ..." --base origin/main [--now 2026-10-11T08:00:00-04:00]

Reads specs/milestones.toml (format: the comments in that file). Same rules for every profile:
  bootstrap first   no other feat PR merges until the bootstrap feature's done note is on the base branch
  freeze            from `freeze` before a milestone ships: only its own features (and `allow`) merge as feat;
                    fixes still merge; anything on its cut list is rejected
  final milestone   from `report_before`: only fixes, reverts, docs and `allow`; at `ship`: nothing merges
A PR over [pr].warn_lines changed lines gets a warning, never a failure. So does a feat PR whose done note has no
verify.py line (or `not verified`) under `## How to check it`, and a feat or fix PR that changes its own spec's
`## Validation`.
"""

import os
import sys
from datetime import datetime, timedelta, timezone

from lib import (TITLE_HELP, as_list, done_at, git, git_lines, load_config, load_milestones, load_shipped, load_specs,
                 note_section, parse_title, parser, root_from)


def fmt(td: timedelta) -> str:
    """'3d 4h' for long spans, 'H:MM' for short ones."""
    mins = int(td.total_seconds() // 60)
    if mins >= 48 * 60:
        return f"{mins // 1440}d {mins % 1440 // 60}h"
    return f"{mins // 60}:{mins % 60:02d}"


def summary(ms: dict, now: datetime) -> str:
    parts = []
    if ms["start"]:
        el = now - ms["start"]
        parts.append(f"elapsed {fmt(el)}" if el >= timedelta(0) else f"starts in {fmt(-el)}")
    upcoming = [m for m in ms["milestones"] if m["ship"] and m["ship"] > now]
    if not upcoming:
        return ", ".join(parts + ["no upcoming milestone with a ship time"])
    m = upcoming[0]
    line = f"next milestone {m['name']} ships in {fmt(m['ship'] - now)}"
    if m["freeze_start"]:
        line += " (frozen now)" if m["freeze_start"] <= now else f", freeze in {fmt(m['freeze_start'] - now)}"
    return ", ".join(parts + [line])


def rule(t: dict, ms: dict, specs: dict, shipped: dict, done: set, now: datetime) -> str | None:
    """Rejection reason, or None if the PR may merge now."""
    kind, scope = t["kind"], t["scope"]
    boot = next((s for s, fm in {**shipped, **specs}.items() if fm.get("bootstrap") is True), None)
    if kind == "feature" and boot and boot not in done and scope != boot:
        return f"bootstrap first: {boot} hasn't merged its done note yet"
    for m in ms["milestones"]:
        if not m["ship"]:
            continue
        if m["final"] and now >= m["ship"]:
            return f"hard stop: {m['name']} shipped at {m['ship'].isoformat(timespec='minutes')}; nothing merges"
        if m["report_start"] and m["report_start"] <= now:
            if kind in ("fix", "revert", "docs") or (kind == "feature" and scope in m["allow"]):
                continue
            return f"{m['name']} report window: only fixes, reverts, docs and {m['allow']}"
        if m["freeze_start"] and m["freeze_start"] <= now < m["ship"]:
            if scope and scope in m["cut"] and kind in ("feature", "fix"):
                return f"{scope} is on {m['name']}'s cut list"
            if kind == "feature" and scope not in m["features"] + m["allow"]:
                return f"{m['name']} freeze: only its features {m['features'] + m['allow']} merge as feat"
            if kind == "plan" and m["final"]:
                return f"{m['name']} freeze: no new plans before the final deadline"
    return None


def changed_lines(root, base: str, exclude: list[str]) -> int:
    total = 0
    for row in git_lines(root, "diff", "--numstat", "--no-renames", f"{base}...HEAD"):
        added, removed, path = row.split("\t", 2)
        if added == "-" or any(path.startswith(e) for e in exclude):
            continue  # binary or excluded
        total += int(added) + int(removed)
    return total


def unchecked_note(root, cfg, t: dict) -> str | None:
    """Warning for a feat PR whose done note has neither the verify.py line nor `not verified` under `## How to check it`."""
    note = root / cfg["paths"]["changes"] / f"{t['scope']}.md"
    if t["kind"] != "feature" or not note.is_file():
        return None
    body = note_section(note.read_text(), "How to check it")
    if body and any(line.lstrip("-* ").startswith("verify: ") or "not verified" in line.lower() for line in body.splitlines()):
        return None
    return (f"{note.relative_to(root)} has no verify.py line under `## How to check it`: run "
            f"`python3 .agents/scripts/verify.py --slug {t['scope']} --worktree .` and paste its last line, or write "
            "`not verified` and what's missing (a unit-test command alone doesn't count)")


def validation_changed(root, base: str, t: dict, specs: dict, shipped: dict) -> str | None:
    """Warning for a feat/fix(<slug>) PR whose own spec's `## Validation` differs from the merge base."""
    fm = (specs.get(t["scope"]) or shipped.get(t["scope"])) if t["kind"] in ("feature", "fix") else None
    if not fm:
        return None
    path = fm["_path"]
    before = note_section(git(root, "show", f"{git(root, 'merge-base', base, 'HEAD').strip()}:{path}", check=False),
                          "Validation")
    if before is None or before == note_section((root / path).read_text(), "Validation"):
        return None
    return (f"{path}: this PR changes its own `## Validation`. That's allowed, but say why in the PR description "
            "(best in a PR of its own); never weaken it to get a pass")


def main(argv=None) -> int:
    ap = parser(__doc__)
    ap.add_argument("--title", required=True, help="PR title")
    ap.add_argument("--base", default="origin/main", help="base ref (default origin/main)")
    ap.add_argument("--now", type=datetime.fromisoformat, help="ISO time with offset, for testing (default: now)")
    args = ap.parse_args(argv)
    root = root_from(args)
    cfg = load_config(root)
    t = parse_title(args.title)
    if t is None:
        print(f"gates: title {args.title!r} isn't one of: {TITLE_HELP}")
        return 1
    now = args.now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    try:
        ms = load_milestones(root, cfg)
    except ValueError as e:
        print(f"gates: milestones.toml: {e}")
        return 1
    specs, shipped = load_specs(root, cfg), load_shipped(root, cfg)
    reason = rule(t, ms, specs, shipped, done_at(root, cfg, args.base), now)
    line = summary(ms, now)

    warn, big = int(cfg["pr"]["warn_lines"]), None
    if reason is None and warn and t["kind"] not in ("plan", "revert"):
        n = changed_lines(root, args.base, as_list(cfg["pr"]["exclude"]))
        line += f"; {n} changed lines"
        if n > warn:
            big = (f"large PR ({n} changed lines, guideline {warn}): split along logical seams if it helps review, "
                   "or say in the description why it's one piece")

    print(f"gates: {line}")
    for w in (big, unchecked_note(root, cfg, t), validation_changed(root, args.base, t, specs, shipped)):
        if w:
            print(f"::warning::{w}" if os.environ.get("GITHUB_ACTIONS") else f"gates: warning: {w}")
    if reason:
        print(f"gates: REJECTED: {reason}")
        return 1
    print("gates: ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
