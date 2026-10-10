"""Shared helpers for the .agents scripts: config, spec front matter, git, gh. Stdlib only."""

import sys

if sys.version_info < (3, 11):  # tomllib; checked first so an older python3 gets this line, not a traceback
    sys.exit(f"{sys.argv[0].rsplit('/', 1)[-1]}: needs Python 3.11+, found {sys.version.split()[0]} (macOS: brew install python)")

import argparse
import copy
import json
import re
import shutil
import subprocess
import tomllib
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

SCHEMA = 3  # bump when an upgrade needs more than refreshed scripts; install.py compares it

DEFAULTS = {
    "schema": SCHEMA,
    "profile": "hackathon",
    "size": "full",
    "paths": {"specs": "specs", "changes": "changes", "reports": "reports"},
    "ownership": {"frozen": ["AGENTS.md", "CLAUDE.md", ".agents/", ".github/"], "open": []},
    "agents": {"max_parallel": 3, "reporter": ""},
    "pr": {"warn_lines": 400, "exclude": []},
    "markers": {
        "debug_patterns": [r"^\s*debugger;?\s*$", r"^\s*breakpoint\(\)", r"^\s*import pdb", r"console\.log\("],
        "ignore": [],
    },
    "watchdog": {
        "heartbeat_minutes": 20,
        "stuck_minutes": 60,
        "max_restarts": 2,
        "stale_claim_minutes": 45,
        "close_claim_minutes": 60,
        "main_red_minutes": 20,
        "min_free_disk_gb": 10,
        "min_free_ram_gb": 2,
        "restart": "",
        "alert": "",
    },
    "release": {
        "url": "",
        "health_path": "/api/health",
        "smoke_paths": ["/"],
        "snapshot_paths": ["/"],
        "secret_patterns": ["sk-", "sk_live_", "AIza", "ghp_", "github_pat_", "xox", "mongodb+srv://", "postgres://", "-----BEGIN"],
    },
    "budget": {"monthly_usd": 0, "reserve_final_hours": 3},
    "verify": {"command": "", "timeout": 300},
}


# --- config ---------------------------------------------------------------------------------------------------------

CONFIG = Path(".agents") / "config.toml"


def find_root(start=None) -> Path:
    """Nearest parent directory containing .agents/config.toml, else the start directory."""
    here = Path(start or Path.cwd()).resolve()
    for d in (here, *here.parents):
        if (d / CONFIG).is_file():
            return d
    return here


def _merge(base: dict, over: dict) -> dict:
    out = copy.deepcopy(base)
    for k, v in over.items():
        out[k] = _merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


def load_config(root: Path) -> dict:
    path = Path(root) / CONFIG
    data = tomllib.loads(path.read_text()) if path.is_file() else {}
    return _merge(DEFAULTS, data)


def specs_dir(root: Path, cfg: dict) -> Path:
    return Path(root) / cfg["paths"]["specs"]


def load_toml(path: Path) -> dict | None:
    return tomllib.loads(path.read_text()) if path.is_file() else None


# --- spec front matter (the YAML subset our specs use) ----------------------------------------------------------------

def _scalar(v: str):
    v = v.strip()
    if v.startswith("[") and v.endswith("]"):
        return [_scalar(x) for x in v[1:-1].split(",") if x.strip()]
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        return v[1:-1]
    if v in ("true", "false"):
        return v == "true"
    if re.fullmatch(r"-?\d+", v):
        return int(v)
    return v


def _strip_comment(line: str) -> str:
    out, quote = [], None
    for ch in line:
        if quote:
            quote = None if ch == quote else quote
        elif ch in "\"'":
            quote = ch
        elif ch == "#":
            break
        out.append(ch)
    return "".join(out).rstrip()


def front_matter(text: str) -> dict:
    """Top-level `key: value`, `key: [a, b]`, and `key:` followed by `  - item` lines."""
    m = re.match(r"^---\r?\n(.*?)\r?\n---", text, re.S)
    if not m:
        return {}
    data, current = {}, None
    for raw in m.group(1).splitlines():
        line = _strip_comment(raw)
        if not line.strip():
            continue
        if not line.startswith((" ", "\t")):
            key, _, val = line.partition(":")
            current = key.strip()
            data[current] = _scalar(val) if val.strip() else []
        elif current is not None and line.strip().startswith("- ") and isinstance(data[current], list):
            data[current].append(_scalar(line.strip()[2:]))
    return data


def as_list(v) -> list:
    return [x for x in (v if isinstance(v, list) else [v] if v not in (None, "") else []) if x not in (None, "")]


SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
RESERVED = {"shipped", "contract", "plan", "docs", "revert"}


def slug_error(slug: str) -> str | None:
    if not SLUG.match(slug) or len(slug) > 32:
        return f"{slug!r} is not a slug (lowercase-kebab, at most 32 characters)"
    if slug in RESERVED:
        return f"{slug!r} is reserved"
    return None


def _read_spec(root: Path, p: Path, **extra) -> dict:
    fm = front_matter(p.read_text())
    fm.update(_path=p.relative_to(root).as_posix(), **extra)
    return fm


def load_specs(root: Path, cfg: dict) -> dict[str, dict]:
    """{slug: front matter} for every specs/features/<slug>/spec.md. The folder name is the feature's ID."""
    d = specs_dir(root, cfg) / "features"
    return {p.parent.name: _read_spec(root, p) for p in sorted(d.glob("*/spec.md")) if not p.parent.name.startswith("_")}


def load_shipped(root: Path, cfg: dict) -> dict[str, dict]:
    """{slug: front matter} for specs/shipped/<milestone>/<slug>/spec.md, moved there by ship.py."""
    d = specs_dir(root, cfg) / "shipped"
    return {p.parent.name: _read_spec(root, p, _milestone=p.parent.parent.name) for p in sorted(d.glob("*/*/spec.md"))}


def done_ids(root: Path, cfg: dict) -> set[str]:
    d = Path(root) / cfg["paths"]["changes"]
    return {p.stem for p in d.glob("*.md")} if d.is_dir() else set()


def done_at(root: Path, cfg: dict, ref: str) -> set[str]:
    """Done notes on a ref (e.g. the PR's base), so a PR's own done note doesn't count yet."""
    changes = cfg["paths"]["changes"].rstrip("/")
    names = git_lines(root, "ls-tree", "--name-only", ref, f"{changes}/")
    return {Path(n).stem for n in names if n.endswith(".md")}


def note_section(text: str, heading: str) -> str | None:
    """Body of `## <heading>` in a done note (stripped), or None if the note has no such heading."""
    m = re.search(rf"^##[ \t]+{re.escape(heading)}[ \t]*$(.*?)(?=^##[ \t]|\Z)", text, re.M | re.S)
    return m.group(1).strip() if m else None


def in_flight(specs: dict[str, dict], done: set[str]) -> dict[str, dict]:
    """Specs not done yet. Only these hold their `owns` exclusively."""
    return {s: fm for s, fm in specs.items() if s not in done}


# --- milestones -----------------------------------------------------------------------------------------------------

UTC = timezone.utc


def parse_span(v) -> timedelta:
    """'2d', '36h', '1:30' (hours:minutes) or '' -> timedelta."""
    v = str(v or "").strip()
    if not v:
        return timedelta(0)
    if m := re.fullmatch(r"(\d+)\s*d", v):
        return timedelta(days=int(m[1]))
    if m := re.fullmatch(r"(\d+)\s*h", v):
        return timedelta(hours=int(m[1]))
    if m := re.fullmatch(r"(\d+):(\d{2})", v):
        return timedelta(hours=int(m[1]), minutes=int(m[2]))
    raise ValueError(f"{v!r} is not a span: use 2d, 36h or H:MM")


def parse_when(v, start: datetime | None) -> datetime | None:
    """'+H:MM' after start, 'YYYY-MM-DD' (through the end of that day, UTC), or an ISO time with an offset.
    None = no date yet (or an offset with no start)."""
    v = str(v or "").strip()
    if not v:
        return None
    if v.startswith("+"):
        return start + parse_span(v[1:]) if start else None
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
        return datetime.combine(date.fromisoformat(v) + timedelta(days=1), time.min, UTC)
    t = datetime.fromisoformat(v)
    if t.tzinfo is None:
        raise ValueError(f"{v!r} needs a UTC offset, e.g. 2026-10-10T09:00:00-04:00")
    return t


def load_milestones(root: Path, cfg: dict) -> dict:
    """{'start': datetime|None, 'milestones': [...]} from specs/milestones.toml, with times resolved.

    Each milestone: name, ship (datetime|None), freeze_start, report_start, final, features, cut, allow.
    A milestone with no resolvable ship time has no deadline and no freeze. Raises ValueError on a bad value.
    """
    raw = load_toml(specs_dir(root, cfg) / "milestones.toml") or {}
    start = None
    if raw.get("start"):
        start = datetime.fromisoformat(str(raw["start"]))
        if start.tzinfo is None:
            raise ValueError("milestones.toml start needs a UTC offset, e.g. 2026-10-10T09:00:00-04:00")
    out = []
    for m in raw.get("milestone", []):
        ship = parse_when(m.get("ship"), start)
        freeze, report = parse_span(m.get("freeze")), parse_span(m.get("report_before"))
        out.append({
            "name": str(m.get("name", "")),
            "ship": ship,
            "freeze_start": ship - freeze if ship and freeze else None,
            "report_start": ship - report if ship and m.get("final") and report else None,
            "final": bool(m.get("final")),
            "features": as_list(m.get("features")),
            "cut": as_list(m.get("cut")),
            "allow": as_list(m.get("allow")),
        })
    return {"start": start, "milestones": out}


def milestone_of(ms: dict, slug: str) -> dict | None:
    return next((m for m in ms["milestones"] if slug in m["features"]), None)


def pick_order(ms: dict, now: datetime) -> list[str]:
    """Slugs agents may pick, in order: milestones top to bottom (skipping passed ones), features left to right.
    Specs in no milestone are the backlog and are never picked."""
    return [s for m in ms["milestones"] if not (m["ship"] and m["ship"] <= now) for s in m["features"]]


# --- PR titles ------------------------------------------------------------------------------------------------------

TITLE = re.compile(r"^(?P<type>[a-z]+)(?:\((?P<scope>[^)]*)\))?!?:\s*\S")
CHANGE_TYPES = ("fix", "refactor", "perf", "test", "chore", "style")
KINDS = {"feat": "feature", **{t: "fix" for t in CHANGE_TYPES}, "docs": "docs", "contract": "contract",
         "plan": "plan", "revert": "revert"}
TITLE_HELP = "feat(<slug>): · fix(<slug>): or fix: (also refactor, perf, test, chore, style) · docs: · contract: · plan: · revert:"


def parse_title(title: str) -> dict | None:
    """{'kind': feature|fix|docs|contract|plan|revert, 'type': 'refactor', 'scope': slug or None}, or None.

    Conventional Commits; a feature PR must name its feature. GitHub's revert button writes 'Revert "..."'."""
    title = (title or "").strip()
    if title.startswith('Revert "'):
        return {"kind": "revert", "type": "revert", "scope": None}
    m = TITLE.match(title)
    if not m or m["type"] not in KINDS:
        return None
    kind, scope = KINDS[m["type"]], (m["scope"] or "").strip() or None
    if kind == "feature" and not scope:
        return None
    return {"kind": kind, "type": m["type"], "scope": scope}


# --- git / gh -------------------------------------------------------------------------------------------------------

def git(root: Path, *args: str, check: bool = True) -> str:
    return subprocess.run(["git", *args], cwd=root, check=check, capture_output=True, text=True).stdout


def git_lines(root: Path, *args: str) -> list[str]:
    return [line for line in git(root, *args).splitlines() if line.strip()]


def changed_files(root: Path, base: str) -> list[str]:
    return git_lines(root, "diff", "--name-only", "--no-renames", f"{base}...HEAD")


def heartbeat_dir(root: Path) -> Path:
    """Shared by every worktree of the repo: <git common dir>/agent-heartbeats. Never committed."""
    common = git(root, "rev-parse", "--git-common-dir", check=False).strip() or ".git"
    return (Path(root) / common).resolve() / "agent-heartbeats"


def gh(root: Path, *args: str) -> subprocess.CompletedProcess | None:
    """Run a gh command that changes something. None if gh is missing."""
    if not shutil.which("gh"):
        return None
    try:
        return subprocess.run(["gh", *args], cwd=root, capture_output=True, text=True, timeout=60)
    except (OSError, subprocess.TimeoutExpired):
        return None


def gh_json(root: Path, *args: str):
    """Run `gh ... --json` and parse it. None if gh is missing, unauthenticated or fails."""
    if not shutil.which("gh"):
        return None
    try:
        r = subprocess.run(["gh", *args], cwd=root, capture_output=True, text=True, timeout=60)
        return json.loads(r.stdout) if r.returncode == 0 and r.stdout.strip() else None
    except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError):
        return None


# --- CLI ------------------------------------------------------------------------------------------------------------

def parser(doc: str) -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=doc, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--root", help="repo root (default: nearest parent with .agents/config.toml)")
    return p


def root_from(args) -> Path:
    return Path(args.root).resolve() if args.root else find_root()
