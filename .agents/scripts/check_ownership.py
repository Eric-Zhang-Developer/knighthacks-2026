#!/usr/bin/env python3
"""Ownership gate: fail a PR that touches files outside what its title allows.

  check_ownership.py --lint-specs                                     specs and milestones are consistent
  check_ownership.py --title "feat(map-data): ..." --base origin/main  every changed file is allowed for that title

Title rules: AGENTS.md ("PR titles"). A feature's ID is its folder name under specs/features/.
"""

import re
import sys

from lib import (TITLE_HELP, as_list, changed_files, done_at, done_ids, git, in_flight, load_config, load_milestones,
                 load_shipped, load_specs, parse_title, parser, root_from, slug_error)


def lint_specs(cfg: dict, specs: dict, shipped: dict, done: set, ms: dict | None) -> list[str]:
    errors = []
    frozen = as_list(cfg["ownership"]["frozen"])
    known = set(specs) | set(shipped)
    for slug in specs:
        if err := slug_error(slug):
            errors.append(f"specs/features/{slug}: {err}")
        if slug in shipped:
            errors.append(f"{slug} is both in features/ and shipped/{shipped[slug]['_milestone']}/")
    if sum(1 for fm in [*specs.values(), *shipped.values()] if fm.get("bootstrap") is True) > 1:
        errors.append("more than one feature has bootstrap: true")
    for slug, fm in specs.items():
        for dep in as_list(fm.get("depends_on")):
            if dep not in known:
                errors.append(f"{slug}: depends_on {dep} does not exist")
        for e in as_list(fm.get("owns")):
            for f in frozen:
                if f.startswith(e) or e.startswith(f):
                    errors.append(f"{slug} owns {e!r}, which overlaps frozen path {f!r}")
    # Only features still in flight hold their paths exclusively; done and shipped ones leave the code to anyone.
    entries = [(s, e) for s, fm in in_flight(specs, done).items() for e in as_list(fm.get("owns"))]
    for i, (s, e) in enumerate(entries):
        for other, o in entries[i + 1:]:
            if other != s and (o.startswith(e) or e.startswith(o)):
                errors.append(f"{s} owns {e!r}, which overlaps {other}'s {o!r}")
    if ms is not None:
        seen: dict[str, str] = {}
        for m in ms["milestones"]:
            for s in m["features"]:
                if s not in known:
                    errors.append(f"milestone {m['name']}: feature {s} does not exist")
                elif s in seen:
                    errors.append(f"{s} is in milestones {seen[s]} and {m['name']}")
                seen.setdefault(s, m["name"])
            for s in m["cut"]:
                if s not in m["features"]:
                    errors.append(f"milestone {m['name']}: cut {s} is not one of its features")
            for s in m["allow"]:
                if s not in known:
                    errors.append(f"milestone {m['name']}: allow {s} does not exist")
    return sorted(set(errors))


def reverted_files(root, base: str) -> set[str]:
    """Files changed by the commits the branch's `git revert` commits undo ("This reverts commit <sha>.")."""
    shas = re.findall(r"This reverts commit ([0-9a-f]{7,40})", git(root, "log", "--format=%B", f"{base}..HEAD"))
    return {f for sha in shas for f in git(root, "show", "--name-only", "--format=", sha, check=False).split()}


def allowed(title: str, cfg: dict, specs: dict, shipped: dict, done: set, revert_files=None):
    """(predicate(path) -> bool, description). Raises ValueError for an unusable title."""
    t = parse_title(title)
    if t is None:
        raise ValueError(f"title {title!r} isn't one of: {TITLE_HELP}")
    sp, changes = cfg["paths"]["specs"].rstrip("/"), cfg["paths"]["changes"].rstrip("/")
    frozen, open_paths = as_list(cfg["ownership"]["frozen"]), as_list(cfg["ownership"]["open"])
    busy = [e for fm in in_flight(specs, done).values() for e in as_list(fm.get("owns"))]

    def under(p, prefixes):
        return any(p.startswith(x) for x in prefixes)

    kind, scope = t["kind"], t["scope"]
    if kind == "contract":
        prefixes = frozen + [f"{sp}/"] + open_paths
    elif kind == "plan":
        prefixes = [f"{sp}/features/", f"{sp}/shipped/", f"{sp}/milestones.toml", f"{sp}/roadmap.md",
                    f"{sp}/context/findings.md"] + open_paths
    elif kind == "revert":
        files = set(revert_files or [])
        if not files:
            raise ValueError("revert PR has no `This reverts commit <sha>` commit: use `git revert`")
        return (lambda p: p in files), f"what the reverted commits changed: {sorted(files)}"
    elif kind == "docs":
        closed = frozen + [f"{sp}/", f"{changes}/"] + busy
        return (lambda p: under(p, open_paths) or (p.endswith(".md") and not under(p, closed))), \
            f"{open_paths} and Markdown outside {sp}/, {changes}/, frozen paths and in-flight features"
    elif kind == "fix" and scope is None:
        closed = frozen + [f"{sp}/", f"{changes}/"] + busy
        return (lambda p: under(p, open_paths + [f"{sp}/decisions/"]) or not under(p, closed)), \
            f"anything but frozen paths, {sp}/ (except decisions), {changes}/ and in-flight features' owns"
    else:
        fm = specs.get(scope) or shipped.get(scope)
        if fm is None:
            raise ValueError(f"unknown feature {scope!r}: no {sp}/features/{scope}/ or {sp}/shipped/*/{scope}/")
        if kind == "feature" and (scope in done or scope not in specs):
            raise ValueError(f"{scope} is already done: use fix({scope}): for changes after its done note")
        if fm.get("bootstrap") is True:
            return (lambda p: True), f"{scope} is bootstrap: anything"
        spec_dir = fm["_path"].rsplit("/", 1)[0] + "/"
        prefixes = as_list(fm.get("owns")) + open_paths + [f"{changes}/{scope}.md", spec_dir, f"{sp}/decisions/{scope}-"]
    return (lambda p: under(p, prefixes)), f"{prefixes}"


def hint(path: str, cfg: dict, specs: dict, shipped: dict, done: set) -> str:
    """Which titles would allow `path`, with why it's closed: 'frozen: needs contract:'."""
    sp, changes = cfg["paths"]["specs"].rstrip("/"), cfg["paths"]["changes"].rstrip("/")
    frozen = as_list(cfg["ownership"]["frozen"])
    owner = next((s for s, fm in in_flight(specs, done).items()
                  if any(path.startswith(e) for e in as_list(fm.get("owns")))), None)
    why = ("frozen" if any(path.startswith(f) for f in frozen) else "spec" if path.startswith(f"{sp}/")
           else "done note" if path.startswith(f"{changes}/") else f"owned by {owner}" if owner else "")
    titles = []
    for title in ("fix: x", "docs: x", "contract: x", "plan: x"):
        if allowed(title, cfg, specs, shipped, done)[0](path):
            titles.append(title[:-2])
    for s, fm in {**shipped, **specs}.items():
        if fm.get("bootstrap") is not True:  # bootstrap may change anything: never the advice
            title = f"feat({s})" if s in specs and s not in done else f"fix({s})"
            if allowed(f"{title}: x", cfg, specs, shipped, done)[0](path):
                titles.append(title)
    need = f"needs {' or '.join(titles)}" if titles else "no title allows it"
    return f"{why}: {need}" if why else need


def main(argv=None) -> int:
    ap = parser(__doc__)
    ap.add_argument("--lint-specs", action="store_true", help="check spec front matter and milestones.toml")
    ap.add_argument("--title", help="PR title to check the diff against")
    ap.add_argument("--base", default="origin/main", help="base ref for the diff (default origin/main)")
    args = ap.parse_args(argv)
    if not args.lint_specs and args.title is None:
        ap.print_help()
        return 2
    root = root_from(args)
    cfg = load_config(root)
    specs, shipped, done = load_specs(root, cfg), load_shipped(root, cfg), done_ids(root, cfg)
    rc = 0
    if args.lint_specs:
        try:
            ms, errs = load_milestones(root, cfg), []
        except ValueError as e:
            ms, errs = None, [f"milestones.toml: {e}"]
        errs = sorted(set(errs + lint_specs(cfg, specs, shipped, done, ms)))
        for e in errs:
            print(f"spec lint: {e}")
        print(f"spec lint: {len(specs)} features, {len(shipped)} shipped, {'FAIL' if errs else 'ok'}")
        rc |= bool(errs)
    if args.title is not None:
        t = parse_title(args.title)
        revert_files = reverted_files(root, args.base) if t and t["kind"] == "revert" else None
        try:
            done = done_at(root, cfg, args.base)
            ok, desc = allowed(args.title, cfg, specs, shipped, done, revert_files)
        except ValueError as e:
            print(f"ownership: {e}")
            return 1
        files = changed_files(root, args.base)
        bad = [f for f in files if not ok(f)]
        for f in bad:
            print(f"ownership: {f} is outside what {args.title!r} may change ({hint(f, cfg, specs, shipped, done)})")
        print(f"ownership: {len(files)} changed files, allowed {desc}: {'FAIL' if bad else 'ok'}")
        rc |= bool(bad)
    return rc


if __name__ == "__main__":
    sys.exit(main())
