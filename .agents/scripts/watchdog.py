#!/usr/bin/env python3
"""Keep an unattended run alive: restart dead sessions, release stale claims, alert on red main and low resources.

  watchdog.py [--once] [--interval 300] [--dry-run]

Each check, every interval:
  STOP       STOP file present: alert once and exit.
  sessions   a heartbeat file older than [watchdog].heartbeat_minutes = dead session: run [watchdog].restart
             (a shell template with {worker} and {worktree}), or alert if no restart command is set. At most
             max_restarts per worker per hour; after that it alerts instead. A fresh heartbeat whose worktree (the
             file's first line) has no new commit and no file change for stuck_minutes = stuck: alert once.
  claims     full size only: draft PRs with no push for stale_claim_minutes get a comment; at
             close_claim_minutes they're closed. (Lite opens PRs when the work is ready, so there are no claims.)
  main       main CI red for longer than main_red_minutes: alert and open a `main-red` issue; closed when green.
  resources  free disk / RAM below min_free_disk_gb / min_free_ram_gb: alert.
Alerts run [watchdog].alert (a shell template with {message}), or print. --dry-run prints actions only.
Heartbeats live in <git common dir>/agent-heartbeats/, shared by every worktree. Settings: .agents/config.toml [watchdog].
One watchdog per repo: a second one exits 1 while <git common dir>/watchdog.pid names a live process.
"""

import json
import os
import platform
import re
import shlex
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from lib import gh, gh_json, git, heartbeat_dir, load_config, parser, root_from


def run_template(template: str, dry: bool, **values) -> None:
    cmd = template.format(**{k: shlex.quote(str(v)) for k, v in values.items()})
    if dry:
        print(f"watchdog: would run: {cmd}")
    else:
        subprocess.run(cmd, shell=True, check=False)


def free_ram_gb() -> float | None:
    try:
        if Path("/proc/meminfo").exists():
            m = re.search(r"MemAvailable:\s+(\d+) kB", Path("/proc/meminfo").read_text())
            return int(m.group(1)) / 1024**2 if m else None
        if platform.system() == "Darwin":
            out = subprocess.run(["vm_stat"], capture_output=True, text=True).stdout
            page = int(re.search(r"page size of (\d+)", out).group(1))
            pages = sum(int(n) for n in re.findall(r"Pages (?:free|inactive|speculative):\s+(\d+)", out))
            return pages * page / 1024**3
    except (OSError, AttributeError, ValueError):
        return None
    return None


def pid_alive(pid: int) -> bool:
    if os.name == "nt":
        return True  # os.kill(pid, 0) would signal the process on Windows: assume alive, a human deletes a stale file
    if pid == os.getpid():
        return False  # our own pid in the file: left by an earlier boot or container
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True  # exists, owned by someone else
    return True


def acquire_lock(path: Path) -> int | None:
    """Create the pidfile with O_EXCL, taking over a stale one. None = ours; else the live holder's pid (0 = unknown)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    for _ in range(2):
        try:
            fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            try:
                pid = int(path.read_text().strip())
            except (OSError, ValueError):
                pid = 0  # unreadable or half-written: treat as stale
            if pid and pid_alive(pid):
                return pid
            path.unlink(missing_ok=True)
            continue
        with os.fdopen(fd, "w") as f:
            f.write(f"{os.getpid()}\n")
        return None
    return 0


def last_activity(worktree: str) -> tuple[float, float] | None:
    """(last commit time, latest of that and any uncommitted file's mtime) for a worktree, or None if unreadable."""
    if not worktree or not Path(worktree).is_dir():
        return None
    try:
        committed = float(git(Path(worktree), "log", "-1", "--format=%ct", check=False).strip())
    except ValueError:
        return None
    latest, skip = committed, False
    for entry in git(Path(worktree), "status", "--porcelain", "-z", "-uall", check=False).split("\0"):
        if skip or len(entry) < 4:  # the token after a rename/copy is its old path
            skip = False
            continue
        skip = entry[0] in "RC"
        try:
            latest = max(latest, (Path(worktree) / entry[3:]).stat().st_mtime)
        except OSError:
            pass  # deleted file
    return committed, latest


def minutes_since(iso: str, now: datetime) -> float:
    return (now - datetime.fromisoformat(iso.replace("Z", "+00:00"))).total_seconds() / 60


class Watchdog:
    def __init__(self, root: Path, cfg: dict, dry: bool):
        self.root, self.cfg, self.dry = root, cfg["watchdog"], dry
        self.claims, self.said_no_gh = cfg["size"] == "full", False
        self.hb_dir = heartbeat_dir(root)
        self.state_path = self.hb_dir.parent / "watchdog-state.json"
        try:
            self.state = json.loads(self.state_path.read_text())
        except (OSError, ValueError):
            self.state = {"commented": [], "alerted": []}
        self.state.setdefault("restarts", {})  # worker -> restart times (epoch seconds), last hour only

    def save(self):
        if not self.dry:
            self.state_path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.state_path.with_name(f".{self.state_path.name}.{os.getpid()}.tmp")
            tmp.write_text(json.dumps(self.state))
            os.replace(tmp, self.state_path)  # a crash mid-write never leaves a torn state file

    def alert(self, message: str, key: str | None = None):
        """Alert; with a key, only once until the condition clears (see clear())."""
        if key and key in self.state["alerted"]:
            return
        print(f"watchdog: ALERT: {message}")
        if self.cfg["alert"]:
            run_template(self.cfg["alert"], self.dry, message=message)
        if key:
            self.state["alerted"].append(key)

    def clear(self, key: str):
        if key in self.state["alerted"]:
            self.state["alerted"].remove(key)

    def check_stop(self) -> bool:
        if (self.root / "STOP").exists():
            self.alert("STOP file present: run is stopping", key="stop")
            return True
        self.clear("stop")
        return False

    def check_sessions(self, now: float):
        if not self.hb_dir.is_dir():
            return
        for hb in sorted(self.hb_dir.iterdir()):
            age = (now - hb.stat().st_mtime) / 60
            worktree = (hb.read_text().strip().splitlines() or [""])[0]
            if age < self.cfg["heartbeat_minutes"]:
                self.clear(f"dead:{hb.name}")
                self.clear(f"cap:{hb.name}")
                self.check_stuck(hb.name, worktree, now)
                continue
            if self.cfg["restart"]:
                recent = [t for t in self.state["restarts"].get(hb.name, []) if now - t < 3600]
                self.state["restarts"][hb.name] = recent
                if len(recent) >= self.cfg["max_restarts"]:
                    self.alert(f"restart cap hit for {hb.name}; not restarting", key=f"cap:{hb.name}")
                    continue
                self.clear(f"cap:{hb.name}")
                print(f"watchdog: {hb.name} silent {age:.0f} min: restarting")
                run_template(self.cfg["restart"], self.dry, worker=hb.name, worktree=worktree)
                recent.append(now)
                if not self.dry:
                    hb.touch()  # give the restarted session a full heartbeat window
            else:
                self.alert(f"session {hb.name} silent {age:.0f} min and no restart command set", key=f"dead:{hb.name}")

    def check_stuck(self, worker: str, worktree: str, now: float):
        """Alive is not progress: alert once per episode when the worktree shows no commit or file change."""
        seen = last_activity(worktree)
        if seen is None:
            return
        committed, latest = seen
        if (now - latest) / 60 >= self.cfg["stuck_minutes"]:
            mins = (now - committed) / 60
            self.alert(f"{worker} is alive but hasn't committed in {mins:.0f} min", key=f"stuck:{worker}")
        else:
            self.clear(f"stuck:{worker}")

    def check_claims(self, now: datetime):
        prs = gh_json(self.root, "pr", "list", "--state", "open", "--draft", "--json", "number,title,updatedAt")
        for pr in prs or []:
            age, n = minutes_since(pr["updatedAt"], now), pr["number"]
            if age >= self.cfg["close_claim_minutes"]:
                msg = f"Closing stale claim: no push for {age:.0f} min (watchdog). The feature is free to reclaim."
                print(f"watchdog: closing #{n} {pr['title']}")
                if not self.dry:
                    gh(self.root, "pr", "close", str(n), "--comment", msg)
            elif age >= self.cfg["stale_claim_minutes"] and n not in self.state["commented"]:
                msg = f"Stale claim: no push for {age:.0f} min. It closes at {self.cfg['close_claim_minutes']} min."
                print(f"watchdog: commenting on #{n}")
                if not self.dry:
                    gh(self.root, "pr", "comment", str(n), "--body", msg)
                self.state["commented"].append(n)

    def check_main(self, now: datetime):
        runs = gh_json(self.root, "run", "list", "--branch", "main", "--limit", "20",
                       "--json", "conclusion,status,createdAt")
        if runs is None and not self.said_no_gh:  # once per process, not every pass
            print("watchdog: gh unavailable or not authenticated: skipping the claims and main CI checks")
            self.said_no_gh = True
        if not runs:
            return
        red = []
        for r in runs:  # newest first
            if r.get("status") != "completed":
                continue
            if r.get("conclusion") not in ("failure", "timed_out"):
                break
            red.append(r)
        if not red:
            self.clear("main-red")
            self.close_main_red_issues()
            return
        mins = minutes_since(red[-1]["createdAt"], now)
        if mins > self.cfg["main_red_minutes"]:
            msg = f"main has been red for {mins:.0f} min: land a FIX or REVERT"
            if "main-red" not in self.state["alerted"]:
                self.open_main_red_issue(msg)
            self.alert(msg, key="main-red")

    def open_main_red_issue(self, msg: str):
        if gh_json(self.root, "issue", "list", "--state", "open", "--label", "main-red", "--json", "number"):
            return
        print("watchdog: opening a main-red issue")
        if not self.dry:
            gh(self.root, "issue", "create", "--label", "main-red", "--title", "main is red",
               "--body", f"{msg}. The owner of the breaking change lands `fix(<slug>): ...`; after that anyone "
                         "may `git revert` it (title `revert: ...`). Opened by the watchdog; it closes this when main is green.")

    def close_main_red_issues(self):
        for i in gh_json(self.root, "issue", "list", "--state", "open", "--label", "main-red", "--json", "number") or []:
            print(f"watchdog: main is green, closing #{i['number']}")
            if not self.dry:
                gh(self.root, "issue", "close", str(i["number"]), "--comment", "main is green again (watchdog).")

    def check_resources(self):
        disk = shutil.disk_usage(self.root).free / 1024**3
        if disk < self.cfg["min_free_disk_gb"]:
            self.alert(f"low disk: {disk:.1f} GB free", key="disk")
        else:
            self.clear("disk")
        ram = free_ram_gb()
        if ram is not None and ram < self.cfg["min_free_ram_gb"]:
            self.alert(f"low RAM: {ram:.1f} GB free: close browsers or run fewer agents", key="ram")
        elif ram is not None:
            self.clear("ram")

    def tick(self) -> bool:
        """One pass. False means stop."""
        if self.check_stop():
            self.save()
            return False
        now = datetime.now(timezone.utc)
        self.check_sessions(time.time())
        if self.claims:
            self.check_claims(now)
        self.check_main(now)
        self.check_resources()
        self.save()
        return True


def main(argv=None) -> int:
    ap = parser(__doc__)
    ap.add_argument("--once", action="store_true", help="run one pass and exit")
    ap.add_argument("--interval", type=int, default=300, help="seconds between passes (default 300)")
    ap.add_argument("--dry-run", action="store_true", help="print actions, change nothing")
    args = ap.parse_args(argv)
    root = root_from(args)
    dog = Watchdog(root, load_config(root), args.dry_run)
    lock = dog.state_path.with_name("watchdog.pid")
    if not args.dry_run:  # a dry run changes nothing, so it may look while the real one runs
        holder = acquire_lock(lock)
        if holder is not None:
            print(f"watchdog: another watchdog is running (pid {holder or 'unknown'}, {lock}); exiting")
            return 1
    try:
        print(f"watchdog: watching {root} (pid {os.getpid()})")
        while dog.tick():
            if args.once:
                return 0
            time.sleep(args.interval)
        print(f"watchdog: exiting: {root / 'STOP'} is present (delete it to run again)")
        return 0
    finally:
        if not args.dry_run:
            lock.unlink(missing_ok=True)


if __name__ == "__main__":
    sys.exit(main())
