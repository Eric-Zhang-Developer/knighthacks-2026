#!/usr/bin/env python3
"""Status: what to review first, time left, in progress, ready next, blocked, done and verified, backlog, needs-human,
main CI, and how the loop is doing.

  status.py --issue            rewrite the pinned "Status" issue (CI does this on every push to main)
  status.py --out -            print it;  --out FILE writes a file
  status.py --offline ...      no gh calls: local branches and commit subjects only, and says so

Anything it can't determine prints as `unknown`, never a guess.
"""

import os
import re
import statistics
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from check_gates import summary
from lib import (as_list, done_ids, gh, gh_json, git, load_config, load_milestones, load_shipped,
                 load_specs, note_section, parse_title, parser, pick_order, root_from)


def when(iso: str) -> datetime:
    return datetime.fromisoformat(iso.replace("Z", "+00:00"))


def age_minutes(iso: str, now: datetime) -> int:
    return int((now - when(iso)).total_seconds() // 60)


def fix_counts(titles: list[str]) -> Counter:
    """{slug: fix(<slug>) and reverted-<slug> merges}. GitHub's 'Revert "feat(x): ..."' counts against x."""
    out = Counter()
    for title in titles:
        inner = title[len('Revert "'):].rstrip('"') if title.startswith('Revert "') else title
        t = parse_title(inner)
        if t and t["scope"] and (inner != title or t["kind"] in ("fix", "revert")):
            out[t["scope"]] += 1
    return out


def subjects(root: Path) -> list[str]:
    """Squash-merge titles on this branch's first-parent history (main in CI), newest first, PR numbers dropped."""
    lines = git(root, "log", "--first-parent", "--format=%s", "-200", check=False).splitlines()  # none yet: []
    return [re.sub(r" \(#\d+\)$", "", s) for s in lines]


def verification(root: Path, cfg: dict, done: set[str]) -> dict[str, str]:
    """{slug: 'verified' | 'not verified'} from each done note's `## How to check it`. Missing means not verified."""
    out = {}
    for slug in done:
        body = note_section((root / cfg["paths"]["changes"] / f"{slug}.md").read_text(), "How to check it") or ""
        lines = [x.lstrip("-* ").strip() for x in body.splitlines()]
        passed = any(re.match(r"verify: `.*` pass\b", x) for x in lines)
        failed = any((x.startswith("verify: ") and " FAIL" in x) or "not verified" in x.lower() for x in lines)
        out[slug] = "verified" if passed and not failed else "not verified"
    return out


def gaps(root: Path, cfg: dict, slug: str) -> str:
    """First line of the done note's `## Gaps`, or '' when it's empty or says None."""
    body = note_section((root / cfg["paths"]["changes"] / f"{slug}.md").read_text(), "Gaps") or ""
    first = body.splitlines()[0].lstrip("-* ").strip() if body else ""
    return "" if re.fullmatch(r"(?i)none( known| yet)?\.?", first) else first


def review_first(root: Path, cfg: dict, done: set[str], checked: dict[str, str], limit: int = 8) -> list[str]:
    """What a person should look at first: no verifier, unverified done features, done notes with gaps, most-fixed."""
    out = []
    if not cfg["verify"]["command"]:
        out.append("- **Verifier not set up** (`[verify].command` is empty): every done feature counts as not verified")
    fixed = fix_counts(subjects(root))
    top_fixed = dict(fixed.most_common(3))
    changes = cfg["paths"]["changes"].rstrip("/")
    stamps = {}  # slug -> when its done note last changed, so recent work outranks long-done work
    when = 0
    for line in git(root, "log", "--format=@%ct", "--name-only", "-500", "--", f"{changes}/", check=False).splitlines():
        if line.startswith("@"):
            when = int(line[1:])
        elif line.strip():
            stamps.setdefault(Path(line).stem, when)  # newest first, so the first time seen is the latest
    rows = []
    for slug in sorted(done | set(top_fixed)):
        unverified = checked.get(slug) == "not verified"
        gap = gaps(root, cfg, slug) if slug in done else ""
        why = (["not verified"] if unverified else []) + ([f"gaps: {gap[:80]}"] if gap else []) + \
              ([f"fixed or reverted {top_fixed[slug]}×"] if slug in top_fixed else [])
        if why:
            rows.append(((unverified, bool(gap), top_fixed.get(slug, 0), stamps.get(slug, 0)), f"- {slug}: " + "; ".join(why)))
    rows.sort(key=lambda r: r[0], reverse=True)  # stable: ties (same flags and time) stay alphabetical
    room = limit - len(out)
    out += [line for _, line in rows[:room]]
    if len(rows) > room:
        out[-1] = f"- … and {len(rows) - room + 1} more (see Done and Loop below)"
    return out or ["- nothing flagged"]


def loop_stats(root: Path, now: datetime, offline: bool) -> list[str]:
    """How much of the work is product versus process, how long PRs wait, where fixes cluster, how long main was red."""
    prs = None if offline else gh_json(root, "pr", "list", "--state", "merged", "--limit", "200",
                                       "--json", "title,createdAt,mergedAt")
    if prs is None:
        titles = subjects(root)
        out = ["_Offline: counted from the last 200 commit subjects on this branch; times unknown._"]
    else:
        titles = [p["title"] for p in prs]
        out = [f"_Last {len(prs)} merged PRs._"]
    parsed = [t for t in map(parse_title, titles) if t]
    if not parsed:
        return out + ["- no PRs with recognised titles yet"]
    kinds = Counter(t["kind"] for t in parsed)
    overhead = kinds["contract"] + kinds["plan"] + kinds["docs"]
    out.append("- by type: " + ", ".join(f"{k} {n}" for k, n in kinds.most_common()))
    out.append(f"- process overhead (contract + plan + docs): {overhead} of {len(parsed)} "
               f"({round(100 * overhead / len(parsed))}%)")
    fixes = fix_counts(titles)
    if fixes:
        out.append("- most fixed: " + ", ".join(f"{s} {n}" for s, n in fixes.most_common(3)))
    out.append(f"- reverts: {kinds['revert']}")
    if prs:
        mins = [(when(p["mergedAt"]) - when(p["createdAt"])).total_seconds() / 60 for p in prs if p.get("mergedAt")]
        out.append(f"- median time open: {round(statistics.median(mins))} min")
    runs = None if offline else gh_json(root, "run", "list", "--branch", "main", "--status", "completed",
                                        "--limit", "100", "--json", "conclusion,updatedAt")
    if runs:
        red, since = 0.0, None
        for r in sorted(runs, key=lambda r: r["updatedAt"]):
            if r["conclusion"] == "failure" and since is None:
                since = when(r["updatedAt"])
            elif r["conclusion"] == "success" and since is not None:
                red += (when(r["updatedAt"]) - since).total_seconds()
                since = None
        if since is not None:
            red += (now - since).total_seconds()
        out.append(f"- main red: {round(red / 60)} min over the last {len(runs)} runs"
                   f"{' (red now)' if since is not None else ''}")
    return out


def build(root: Path, cfg: dict, now: datetime, offline: bool) -> str:
    specs, shipped, done = load_specs(root, cfg), load_shipped(root, cfg), done_ids(root, cfg)
    wd, full = cfg["watchdog"], cfg["size"] == "full"
    sha = (git(root, "rev-parse", "--short", "HEAD", check=False).strip() or "unknown")
    try:
        ms = load_milestones(root, cfg)
        time_line = summary(ms, now)
    except ValueError as e:
        ms, time_line = {"start": None, "milestones": []}, f"unknown (milestones.toml: {e})"
    out = [
        "# Status",
        "",
        f"Checkpoint {now.isoformat(timespec='minutes')} · HEAD `{sha}` · profile {cfg['profile']}/{cfg['size']}",
        f"Time: {time_line}",
        f"STOP: {'present: agents must stop' if (root / 'STOP').exists() else 'not present'}",
        "",
    ]
    checked = verification(root, cfg, done)
    out += ["## Review first"] + review_first(root, cfg, done, checked) + [""]

    prs = None if offline else gh_json(root, "pr", "list", "--state", "open", "--limit", "200",
                                       "--json", "number,title,isDraft,updatedAt,url")
    claimed = set()
    out.append("## In progress")
    if prs is None:
        out.append("_From local branches named after a feature that isn't done; PR state unknown (offline or gh unavailable)._")
        refs = git(root, "for-each-ref", "refs/heads", "--format=%(refname:short)\t%(committerdate:iso-strict)", check=False)
        rows = [row.split("\t") for row in refs.splitlines()]
        rows = [(n, stamp) for n, stamp in rows if n in specs and n not in done]  # not main, not v0.2, not done work
        out += [f"- `{n}`, last commit {age_minutes(stamp, now)} min ago" for n, stamp in rows] or ["- none"]
    else:
        for pr in sorted(prs, key=lambda p: p["number"]):
            t = parse_title(pr["title"])
            if t and t["kind"] == "feature":
                claimed.add(t["scope"])
            age = age_minutes(pr["updatedAt"], now)
            flag = ""
            if full and pr["isDraft"]:
                flag = " **STALE: close**" if age >= wd["close_claim_minutes"] else \
                    " **stale**" if age >= wd["stale_claim_minutes"] else ""
            out.append(f"- [#{pr['number']}]({pr['url']}) {pr['title']} · {'draft' if pr['isDraft'] else 'ready'}"
                       f" · updated {age} min ago{flag}")
        if not prs:
            out.append("- none")

    def name(s):
        return (specs.get(s) or shipped.get(s) or {}).get("name", "")

    order = [s for s in pick_order(ms, now) if s in specs and s not in done]
    deps_done = {s: all(d in done for d in as_list(specs[s].get("depends_on"))) for s in order}
    ready = [s for s in order if s not in claimed and deps_done[s]]
    blocked = [s for s in order if s not in claimed and not deps_done[s]]
    scheduled = {s for m in ms["milestones"] for s in m["features"]}
    backlog = [s for s in specs if s not in scheduled and s not in done]
    missed = [(m["name"], s) for m in ms["milestones"] if m["ship"] and m["ship"] <= now
              for s in m["features"] if s in specs and s not in done]

    out += ["", "## Ready next (pick order)"]
    out += [f"- {s} {name(s)}" for s in ready] or ["- none"]
    if len(ready) + len(claimed) < 2 * int(cfg["agents"]["max_parallel"]):
        out.append(f"- **Backlog low** ({len(ready)} ready + {len(claimed)} claimed < 2 × "
                   f"{cfg['agents']['max_parallel']} agents): plan more, or move backlog specs into a milestone.")
    out += ["", "## Blocked"]
    out += [f"- {s}: waiting on {[d for d in as_list(specs[s].get('depends_on')) if d not in done]}" for s in blocked] or ["- none"]
    if missed:
        out += ["", "## Missed (milestone passed, not done)"]
        out += [f"- {m}: {s} {name(s)}" for m, s in missed]
    out += ["", "## Done"]
    out += [f"- {s} {name(s)}: {_first_line(root, cfg, s)}" for s in sorted(done) if s in specs] or ["- none"]
    if shipped:
        by_m = Counter(fm["_milestone"] for fm in shipped.values())
        out.append("- shipped: " + ", ".join(f"{m} ({n})" for m, n in sorted(by_m.items())))
    n_ok = sum(v == "verified" for v in checked.values())
    out += ["", "## Verification (done notes)",
            f"- verified: {n_ok} · not verified: {len(checked) - n_ok}"
            + ("" if cfg["verify"]["command"] else " · **verifier not set up** (`[verify].command` is empty)"),
            "- _From each note's verify.py line under `## How to check it`; no line counts as not verified. Merged, "
            "checked by CI, verified live and tried by a user stay four different things._"]
    out += ["", "## Backlog (in no milestone)"]
    out += [f"- {s} {name(s)}" for s in backlog] or ["- none"]

    out += ["", "## Needs human"]
    asks = None if offline else gh_json(root, "issue", "list", "--state", "open", "--label", "needs-human",
                                        "--limit", "100", "--json", "number,title,labels,url")
    if asks is None:
        out.append("- unknown (offline or gh unavailable): check issues labelled `needs-human`")
    for i in sorted(asks or [], key=lambda i: i["number"]):
        door = " **one-way door**" if any(lb["name"] == "one-way-door" for lb in i.get("labels", [])) else ""
        out.append(f"- [#{i['number']}]({i['url']}) {i['title']}{door}")
    if asks == []:
        out.append("- none")

    out += ["", "## main CI"]
    runs = None if offline else gh_json(root, "run", "list", "--branch", "main", "--status", "completed",
                                        "--limit", "5", "--json", "databaseId,conclusion,updatedAt,url")
    runs = [r for r in runs or [] if str(r.get("databaseId")) != os.environ.get("GITHUB_RUN_ID")]  # not this run
    if not runs:
        out.append("- unknown (offline, gh unavailable, or no finished runs)")
    else:
        r = runs[0]
        out.append(f"- {r.get('conclusion')} · finished {age_minutes(r['updatedAt'], now)} min ago · {r['url']}")

    out += ["", "## Loop"] + loop_stats(root, now, offline)
    return "\n".join(out) + "\n"


def _first_line(root, cfg, slug) -> str:
    p = root / cfg["paths"]["changes"] / f"{slug}.md"
    lines = [x.strip() for x in p.read_text().splitlines() if x.strip() and not x.startswith("#")]
    return lines[0][:140] if lines else ""


def update_issue(root: Path, text: str) -> int:
    """Rewrite the body of the open issue labelled `status`, creating and pinning it the first time."""
    found = gh_json(root, "issue", "list", "--state", "open", "--label", "status", "--json", "number")
    if found is None:
        print("status: gh unavailable or not authenticated; nothing updated")
        return 1
    if found:
        r, verb = gh(root, "issue", "edit", str(found[0]["number"]), "--body", text), "updated"
    else:
        r, verb = gh(root, "issue", "create", "--title", "Status", "--label", "status", "--body", text), "created"
        if r and r.returncode == 0:
            p = gh(root, "issue", "pin", r.stdout.strip().rsplit("/", 1)[-1])
            verb += " and pinned" if p and p.returncode == 0 else " (pinning failed; pin it by hand)"
    ok = bool(r) and r.returncode == 0
    print(f"status: {verb + ' the Status issue' if ok else 'failed: ' + (r.stderr.strip() if r else 'no gh')}")
    return 0 if ok else 1


def main(argv=None) -> int:
    ap = parser(__doc__)
    ap.add_argument("--out", help="output file, or '-' for stdout")
    ap.add_argument("--issue", action="store_true", help="rewrite the pinned issue labelled `status`")
    ap.add_argument("--now", type=datetime.fromisoformat, help="ISO time with offset (default: now)")
    ap.add_argument("--offline", action="store_true", help="don't call gh")
    args = ap.parse_args(argv)
    root = root_from(args)
    cfg = load_config(root)
    now = args.now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    if not (args.out or args.issue):
        ap.error("pass --issue or --out")
    text = build(root, cfg, now, args.offline)
    if args.issue:
        return update_issue(root, text)
    if args.out == "-":
        sys.stdout.write(text)
        return 0
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text)
    print(f"status: wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
