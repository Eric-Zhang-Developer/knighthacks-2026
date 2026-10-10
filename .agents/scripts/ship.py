#!/usr/bin/env python3
"""Close out a milestone: archive its done specs and write one walkthrough page for the release.

  ship.py <milestone> [--dry-run]

For each feature in the milestone that has a done note:
  moves specs/features/<slug>/ to specs/shipped/<milestone>/<slug>/
Then writes specs/shipped/<milestone>/README.md from the done notes and decisions, so a person can read what the
release did in one sitting, and prints the `gh release create` command that uses it as the release notes.
Features without a done note stay where they are and are listed. Nothing is committed: open a `plan:` PR with it.
The walkthrough is stitched from the notes, not written by a model, so it is only as good as the done notes.
"""

import shutil
import sys
from datetime import datetime, timezone

from lib import done_ids, load_config, load_milestones, load_specs, parser, root_from, specs_dir


def walkthrough(root, cfg, name: str, slugs: list[str], specs: dict, now: datetime) -> str:
    changes = root / cfg["paths"]["changes"]
    decisions = specs_dir(root, cfg) / "decisions"
    out = [f"# {name}", "", f"Shipped {now.date().isoformat()}: {len(slugs)} feature(s). Built from the done notes in "
           f"`{cfg['paths']['changes']}/` and the decisions in `{cfg['paths']['specs']}/decisions/`.", ""]
    for slug in slugs:
        note = (changes / f"{slug}.md").read_text().strip().splitlines()
        if note and note[0].startswith("# "):
            note = note[1:]  # the note's own title; the section heading replaces it
        body = "\n".join(line.replace("## ", "#### ", 1) if line.startswith("## ") else line for line in note).strip()
        out += [f"## {specs[slug].get('name') or slug} (`{slug}`)", "", body or "_No done note text._", ""]
        logs = sorted(decisions.glob(f"{slug}-*.md")) if decisions.is_dir() else []
        if logs:
            out.append("Decisions: " + ", ".join(f"[{p.stem}](../../decisions/{p.name})" for p in logs))
            out.append("")
    return "\n".join(out).rstrip() + "\n"


def main(argv=None) -> int:
    ap = parser(__doc__)
    ap.add_argument("milestone", help="milestone name from specs/milestones.toml")
    ap.add_argument("--dry-run", action="store_true", help="print what would move, change nothing")
    args = ap.parse_args(argv)
    root = root_from(args)
    cfg = load_config(root)
    try:
        ms = load_milestones(root, cfg)
    except ValueError as e:
        print(f"ship: milestones.toml: {e}")
        return 1
    m = next((m for m in ms["milestones"] if m["name"] == args.milestone), None)
    if m is None:
        print(f"ship: no milestone {args.milestone!r} in specs/milestones.toml")
        return 1
    specs, done = load_specs(root, cfg), done_ids(root, cfg)
    ready = [s for s in m["features"] if s in specs and s in done]
    left = [s for s in m["features"] if s in specs and s not in done]
    dest = specs_dir(root, cfg) / "shipped" / m["name"]
    for s in left:
        print(f"ship: {s} has no done note; it stays in specs/features/ (cut it or move it to a later milestone)")
    if not ready:
        print("ship: nothing to ship")
        return 1
    page = walkthrough(root, cfg, m["name"], ready, specs, datetime.now(timezone.utc))
    for s in ready:
        print(f"ship: {'would move' if args.dry_run else 'moved'} specs/features/{s}/ -> "
              f"{dest.relative_to(root).as_posix()}/{s}/")
        if not args.dry_run:
            dest.mkdir(parents=True, exist_ok=True)
            shutil.move(str(specs_dir(root, cfg) / "features" / s), str(dest / s))
    readme = dest / "README.md"
    if not args.dry_run:
        readme.write_text(page)
    print(f"ship: {'would write' if args.dry_run else 'wrote'} {readme.relative_to(root).as_posix()}")
    print(f"ship: next: open a `plan: ship {m['name']}` PR, then "
          f"gh release create {m['name']} --title {m['name']} --notes-file {readme.relative_to(root).as_posix()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
