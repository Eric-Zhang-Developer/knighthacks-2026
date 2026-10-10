#!/usr/bin/env python3
"""Is this PR ready to merge? One pass over GitHub's whole verdict, not just green CI.

  pr_ready.py [PR]          PR number, URL or branch (default: the PR for the current branch)

Checks in this order and stops at the first blocker:
  exit 3  closed, merged, or still a draft
  exit 4  merge conflicts: rebase on origin/main
  exit 5  a reviewer requested changes
  exit 6  unresolved review threads
  exit 7  failing checks (named)
  exit 8  checks still pending
  exit 0  ready: merge it
  exit 1  gh missing, not logged in, or a query failed
  exit 2  usage error
"""

import shutil
import sys

from lib import gh_json, parser, root_from

FIELDS = "number,url,state,isDraft,mergeable,reviewDecision,statusCheckRollup"
THREADS = """query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) { pullRequest(number: $number) {
    reviewThreads(first: 100) { nodes { isResolved } } } } }"""
FAIL = {"FAILURE", "ERROR", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED", "STARTUP_FAILURE", "STALE"}
PASS = {"SUCCESS", "NEUTRAL", "SKIPPED"}


def check_state(c: dict) -> str:
    """'fail', 'pending' or 'pass' for one statusCheckRollup entry (a CheckRun or a commit StatusContext)."""
    if "context" in c:  # StatusContext: state is SUCCESS, FAILURE, ERROR, PENDING or EXPECTED
        state = c.get("state")
    else:  # CheckRun: a conclusion only once status is COMPLETED
        state = c.get("conclusion") if c.get("status") == "COMPLETED" else None
    return "fail" if state in FAIL else "pass" if state in PASS else "pending"


def unresolved_threads(root, pr: dict) -> int | None:
    owner, repo = pr["url"].split("/")[-4:-2]
    data = gh_json(root, "api", "graphql", "-f", f"query={THREADS}", "-f", f"owner={owner}", "-f", f"repo={repo}",
                   "-F", f"number={pr['number']}")
    try:
        nodes = data["data"]["repository"]["pullRequest"]["reviewThreads"]["nodes"]
    except (TypeError, KeyError):
        return None
    # ponytail: first 100 threads only; paginate if a PR ever has more
    return sum(1 for n in nodes if not n.get("isResolved"))


def verdict(root, pr: dict) -> tuple[int, str]:
    """(exit code, one line) for the first blocker, in the order of the docstring."""
    if pr.get("state") != "OPEN":
        return 3, f"{pr.get('state', '?').lower()}: nothing to merge"
    if pr.get("isDraft"):
        return 3, "draft: expected while the work is in progress (a claim opens as a draft); when it's done, mark it ready with `gh pr ready`"
    if pr.get("mergeable") == "CONFLICTING":
        return 4, "merge conflicts: rebase on origin/main"
    if pr.get("reviewDecision") == "CHANGES_REQUESTED":
        return 5, "changes requested: address the review, then ask for another"
    open_threads = unresolved_threads(root, pr)
    if open_threads is None:
        return 1, "could not read review threads (gh api graphql failed; try `gh auth status`)"
    if open_threads:
        return 6, f"{open_threads} unresolved review thread(s): answer or resolve them"
    checks = pr.get("statusCheckRollup") or []
    for code, kind in ((7, "fail"), (8, "pending")):
        if hit := [c.get("name") or c.get("context") or "?" for c in checks if check_state(c) == kind]:
            return code, f"{'failing' if kind == 'fail' else 'pending'} checks: {', '.join(hit)}"
    if pr.get("mergeable") == "UNKNOWN":  # GitHub recomputes this for a few seconds after the base branch moves
        return 8, "GitHub is still checking for conflicts (mergeable: UNKNOWN): run again in a few seconds"
    return 0, "ready"


def main(argv=None) -> int:
    p = parser(__doc__)
    p.add_argument("pr", nargs="?", help="PR number, URL or branch (default: the current branch's PR)")
    args = p.parse_args(argv)
    root = root_from(args)
    if not shutil.which("gh"):
        print("pr_ready: gh is not installed (https://cli.github.com)")
        return 1
    pr = gh_json(root, "pr", "view", *([args.pr] if args.pr else []), "--json", FIELDS)
    if not isinstance(pr, dict):
        print("pr_ready: could not read the PR (no PR for this branch, or gh not logged in: try `gh auth status`)")
        return 1
    code, line = verdict(root, pr)
    print(f"#{pr.get('number', '?')}: {line}")
    print(f"pr_ready: {'ready to merge' if code == 0 else 'not ready'} ({pr.get('url', '')})")
    return code


if __name__ == "__main__":
    sys.exit(main())
