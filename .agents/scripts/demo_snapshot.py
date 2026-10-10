#!/usr/bin/env python3
"""Save a static, database-free copy of the live demo, so a throttled backend can't sink the presentation.

  demo_snapshot.py --out public/snapshot [--url https://my-app.example]

Fetches every path in .agents/config.toml [release].snapshot_paths and writes it under --out ("/" -> index.html,
"/api/items" -> api/items). Writes manifest.json with the url, the commit from the health endpoint (if any),
the time, and each file's status and sha256. Exit 1 if any path fails. 
"""

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from lib import as_list, load_config, parser, root_from
from verify_release import check_origin, fetch


def target(out: Path, path: str) -> Path:
    rel = path.split("?")[0].strip("/")
    if not rel:
        return out / "index.html"
    if ".." in rel.split("/"):
        raise ValueError(f"refusing path with '..': {path}")
    return out / rel


def snapshot(origin: str, rel: dict, out: Path) -> dict:
    manifest = {"url": origin, "commit": None, "taken_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "files": [], "ok": True}
    try:
        status, body = fetch(origin + rel["health_path"])
        if status == 200:
            manifest["commit"] = json.loads(body or b"{}").get("commit")
    except (ConnectionError, ValueError):
        pass  # commit stays null: unknown, not guessed
    for path in as_list(rel["snapshot_paths"]):
        entry = {"path": path}
        try:
            status, body = fetch(origin + path)
            entry["status"] = status
            if status == 200:
                dest = target(out, path)
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(body)
                entry.update(file=dest.relative_to(out).as_posix(), sha256=hashlib.sha256(body).hexdigest())
        except (ConnectionError, ValueError) as e:
            entry["error"] = str(e)
        manifest["ok"] &= entry.get("status") == 200
        manifest["files"].append(entry)
    out.mkdir(parents=True, exist_ok=True)
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest


def main(argv=None) -> int:
    ap = parser(__doc__)
    ap.add_argument("--out", required=True, help="folder to write the snapshot into")
    ap.add_argument("--url", help="origin to snapshot (default .agents/config.toml [release].url)")
    ap.add_argument("--allow-http", action="store_true", help=argparse.SUPPRESS)
    args = ap.parse_args(argv)
    root = root_from(args)
    cfg = load_config(root)
    try:
        origin = check_origin(args.url or cfg["release"]["url"], args.allow_http)
    except ValueError as e:
        print(f"demo_snapshot: {e}")
        return 2
    m = snapshot(origin, cfg["release"], Path(args.out))
    for f in m["files"]:
        print(f"demo_snapshot: {f['path']}: {f.get('status', f.get('error'))}")
    print(f"demo_snapshot: {'ok' if m['ok'] else 'FAIL'}, commit {m['commit'] or 'unknown'}, manifest in {args.out}")
    return 0 if m["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
