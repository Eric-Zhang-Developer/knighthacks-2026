#!/usr/bin/env python3
"""Keep one GitHub issue per feature spec, and one GitHub milestone per milestone in specs/milestones.toml.

  sync_issues.py [--dry-run]

CI runs this on every push to main. For each specs/features/<slug>/spec.md:
  no issue with "<!-- spec: <slug> -->" in its body   create one, titled with the spec's name, labelled `feature`
  the spec's milestone changed                        move the issue to it (or off it, for the backlog)
  changes/<slug>.md exists (done)                     close the issue
Issues are matched by that hidden marker, never by title, so people can retitle them. The spec stays the source of
truth. Bodies and comments are never rewritten, and a closed issue is never reopened (a person may have closed it on
purpose). Each milestone with a ship time becomes a GitHub milestone with that due date. Also makes sure the labels
the workflow uses exist.
"""

import re
import sys
from datetime import timedelta

from lib import (UTC, as_list, done_ids, gh, gh_json, load_config, load_milestones, load_specs, milestone_of,
                 parser, root_from)

LABELS = {
    "feature": ("1d76db", "A feature spec in specs/features/"),
    "needs-human": ("d93f0b", "A judgment call waiting on a person"),
    "one-way-door": ("b60205", "A decision that's expensive to undo; agents take no default"),
    "blocked": ("fbca04", "Work that can't continue until something else happens"),
    "main-red": ("b60205", "main CI is failing"),
    "contract-change": ("5319e7", "A change to frozen shared files (a contract: PR)"),
    "status": ("0e8a16", "The pinned status report"),
    "bug": ("d73a4a", "Something doesn't work; reproduce it on origin/main before fixing"),
    "needs-info": ("c5def5", "A bug report that couldn't be reproduced; says what's missing"),
}
MARKER = re.compile(r"<!-- spec: ([a-z0-9-]+) -->")


def ensure_labels(root, dry: bool) -> list[str]:
    have = {lb["name"] for lb in gh_json(root, "label", "list", "--limit", "200", "--json", "name") or []}
    made = []
    for name, (color, desc) in LABELS.items():
        if name not in have:
            made.append(name)
            if not dry:
                gh(root, "label", "create", name, "--color", color, "--description", desc, "--force")
    return made


def milestone_plan(ms: dict, have: list[dict]) -> list[tuple]:
    """('create', title, due) | ('due', number, title, due) for GitHub milestones. due is ISO or None.
    Compared by date only: GitHub normalizes the time of day."""
    by_title = {m["title"]: m for m in have}
    actions = []
    for m in ms["milestones"]:
        # A second before ship, so "ship = 2026-11-15" (through the end of that day) shows as due Nov 15.
        due = (m["ship"] - timedelta(seconds=1)).astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ") if m["ship"] else None
        got = by_title.get(m["name"])
        if got is None:
            actions.append(("create", m["name"], due))
        elif due and (got.get("due_on") or "")[:10] != due[:10]:
            actions.append(("due", got["number"], m["name"], due))
    return actions


def plan(specs: dict, done: set, ms: dict, issues: list[dict], repo_url: str, branch: str) -> list[tuple]:
    """('create', slug, title, body, milestone|None) | ('move', number, milestone|None) | ('close', number, slug)."""
    found = {}
    for i in issues:
        if m := MARKER.search(i.get("body") or ""):
            found.setdefault(m[1], i)
    actions = []
    for slug, fm in specs.items():
        target = (milestone_of(ms, slug) or {}).get("name")
        issue = found.get(slug)
        if issue is None:
            if slug in done:
                continue  # finished before syncing started: no point opening a closed issue
            deps = ", ".join(as_list(fm.get("depends_on"))) or "none"
            body = (f"Spec: [{fm['_path']}]({repo_url}/blob/{branch}/{fm['_path']})\n\n"
                    f"Depends on: {deps}\n\n"
                    f"The spec is the source of truth; change scope there, discuss here. "
                    f"This closes when `changes/{slug}.md` lands on {branch}.\n\n<!-- spec: {slug} -->")
            actions.append(("create", slug, str(fm.get("name") or slug), body, target))
            continue
        if issue["state"].upper() != "OPEN":
            continue
        if slug in done:
            actions.append(("close", issue["number"], slug))
        elif ((issue.get("milestone") or {}).get("title")) != target:
            actions.append(("move", issue["number"], target))
    return actions


def main(argv=None) -> int:
    ap = parser(__doc__)
    ap.add_argument("--dry-run", action="store_true", help="print what would change, change nothing")
    args = ap.parse_args(argv)
    root = root_from(args)
    cfg = load_config(root)
    try:
        ms = load_milestones(root, cfg)
    except ValueError as e:
        print(f"sync_issues: milestones.toml: {e}")
        return 1
    repo = gh_json(root, "repo", "view", "--json", "url,defaultBranchRef")
    if repo is None:
        print("sync_issues: gh unavailable, not authenticated, or no GitHub remote; nothing synced")
        return 1
    made = ensure_labels(root, args.dry_run)
    have = gh_json(root, "api", "repos/{owner}/{repo}/milestones?state=all&per_page=100") or []
    m_actions = milestone_plan(ms, have)
    issues = gh_json(root, "issue", "list", "--label", "feature", "--state", "all", "--limit", "1000",
                     "--json", "number,title,state,body,milestone") or []
    actions = plan(load_specs(root, cfg), done_ids(root, cfg), ms, issues, repo["url"], repo["defaultBranchRef"]["name"])
    failed = 0
    for a in m_actions + actions:
        if a[0] == "create" and len(a) == 3:
            cmd = ["api", "-X", "POST", "repos/{owner}/{repo}/milestones", "-f", f"title={a[1]}"]
            cmd += ["-f", f"due_on={a[2]}"] if a[2] else []
            what = f"milestone {a[1]}"
        elif a[0] == "due":
            cmd = ["api", "-X", "PATCH", f"repos/{{owner}}/{{repo}}/milestones/{a[1]}", "-f", f"due_on={a[3]}"]
            what = f"milestone {a[2]} due {a[3]}"
        elif a[0] == "create":
            cmd = ["issue", "create", "--title", a[2], "--body", a[3], "--label", "feature"]
            cmd += ["--milestone", a[4]] if a[4] else []
            what = f"issue for {a[1]}"
        elif a[0] == "move":
            cmd = ["issue", "edit", str(a[1])] + (["--milestone", a[2]] if a[2] else ["--remove-milestone"])
            what = f"#{a[1]} to {a[2] or 'the backlog'}"
        else:
            cmd = ["issue", "close", str(a[1]), "--comment", f"Done: `{cfg['paths']['changes']}/{a[2]}.md` is on main."]
            what = f"#{a[1]} ({a[2]})"
        print(f"sync_issues: {'would ' if args.dry_run else ''}{a[0]} {what}")
        if not args.dry_run:
            r = gh(root, *cmd)
            if not r or r.returncode != 0:
                failed += 1
                print(f"sync_issues: failed: {r.stderr.strip() if r else 'no gh'}")
    verb = "would add" if args.dry_run else "added"
    print(f"sync_issues: {len(actions)} issue and {len(m_actions)} milestone change(s), {verb} {len(made)} label(s)"
          f"{', ' + str(failed) + ' failed' if failed else ''}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
