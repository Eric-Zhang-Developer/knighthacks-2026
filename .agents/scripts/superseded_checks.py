"""Discard only cancelled checks proven superseded in the same GitHub context."""
from collections import Counter
from datetime import datetime

import lib

QUERY = """query($owner: String!, $repo: String!, $number: Int!) {
 repository(owner: $owner, name: $repo) { pullRequest(number: $number) {
  headRefOid
  commits(last: 1) { nodes { commit { oid statusCheckRollup { contexts(first: 100) {
   pageInfo { hasNextPage }
   nodes { __typename ... on CheckRun {
    name detailsUrl status conclusion startedAt completedAt
    checkSuite { app { id } commit { oid } workflowRun { workflow { id } } }
   } ... on StatusContext { context state targetUrl } }
  } } } } }
 } }
}"""


def identity(check):
    """Match the exact CheckRun in both API snapshots, never just its display name."""
    fields = ("name", "detailsUrl", "status", "conclusion", "startedAt", "completedAt")
    if check.get("__typename") != "CheckRun" or not all(check.get(key) for key in fields):
        return None
    return tuple(check[key] for key in fields)


def snapshot(checks):
    """Compare every state, including unfinished runs, without relying on API order."""
    result = []
    for check in checks:
        if check.get("__typename") == "CheckRun":
            fields = ("name", "detailsUrl", "status", "conclusion", "startedAt", "completedAt")
            kind = "CheckRun"
        elif "context" in check:
            fields = ("context", "state", "targetUrl")
            kind = "StatusContext"
        else:
            return None
        result.append((kind, *(check.get(field) for field in fields)))
    return Counter(result)


def proof(check, head):
    try:
        suite = check["checkSuite"]
        context = (suite["commit"]["oid"], suite["app"]["id"], suite["workflowRun"]["workflow"]["id"], check["name"])
        if context[0] != head or not all(context):
            return None
        started = datetime.fromisoformat(check["startedAt"].replace("Z", "+00:00"))
        completed = datetime.fromisoformat(check["completedAt"].replace("Z", "+00:00"))
        if started.tzinfo is None or completed.tzinfo is None:
            return None
        return context, started, completed
    except (KeyError, TypeError, ValueError, AttributeError):
        return None


def current_checks(root, pr, checks, accepted):
    """Fail closed on missing proof, pagination, API errors or a changed head/snapshot."""
    cancelled = [c for c in checks if c.get("__typename") == "CheckRun"
                 and c.get("status") == "COMPLETED" and c.get("conclusion") == "CANCELLED"]
    head = pr.get("headRefOid")
    if not cancelled or not head:
        return checks
    owner, repo = pr["url"].split("/")[-4:-2]
    data = lib.gh_json(root, "api", "graphql", "-f", f"query={QUERY}", "-f", f"owner={owner}",
                       "-f", f"repo={repo}", "-F", f"number={pr['number']}")
    try:
        fresh = data["data"]["repository"]["pullRequest"]
        commit = fresh["commits"]["nodes"][0]["commit"]
        contexts = commit["statusCheckRollup"]["contexts"]
        if fresh["headRefOid"] != head or commit["oid"] != head or contexts["pageInfo"]["hasNextPage"] is not False:
            return checks
        # A new pending/failing check must not disappear between the two API snapshots.
        original_snapshot = snapshot(checks)
        if original_snapshot is None or original_snapshot != snapshot(contexts["nodes"]):
            return checks
        original = Counter(identity(c) for c in checks)
        fresh_ids = Counter(identity(c) for c in contexts["nodes"])
        runs = [c for c in contexts["nodes"] if identity(c) is not None
                and original[identity(c)] == fresh_ids[identity(c)] == 1]
        successes = [proof(c, head) for c in runs if c.get("status") == "COMPLETED" and c.get("conclusion") in accepted]
        superseded = set()
        for c in runs:
            old = proof(c, head)
            if c.get("conclusion") != "CANCELLED" or old is None:
                continue
            if any(new and new[0] == old[0] and new[1] > old[1] and new[2] > old[2] for new in successes):
                superseded.add(identity(c))
        return [c for c in checks if identity(c) not in superseded]
    except (KeyError, TypeError, IndexError):
        return checks
