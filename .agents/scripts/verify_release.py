#!/usr/bin/env python3
"""Verify the deploy, not the merge: production serves the reviewed commit, smoke paths answer, no leaked secrets.

  verify_release.py --commit "$(git rev-parse HEAD)" [--url https://my-app.example]

Checks, against .agents/config.toml [release]:
  health   GET <url><health_path> returns JSON {"commit": "<sha>"} matching --commit (7+ hex chars)
  smoke    every smoke_paths entry answers 200
  secrets  the home page and its same-origin <script src> bundles contain none of secret_patterns
Prints a JSON report and appends a one-line receipt to <reports>/deploys.md. Exit 1 on any failure.
"""

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from urllib.parse import urljoin, urlsplit

from lib import as_list, load_config, parser, root_from

TIMEOUT = 10
MAX_BYTES = 5 * 1024 * 1024
MAX_BUNDLES = 64


def fetch(url: str) -> tuple[int, bytes]:
    req = urllib.request.Request(url, headers={"User-Agent": "release-verify"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.status, r.read(MAX_BYTES)
    except urllib.error.HTTPError as e:
        e.close()
        return e.code, b""
    except (urllib.error.URLError, OSError) as e:
        raise ConnectionError(f"{url}: {e}") from e


def check_origin(url: str, allow_http: bool) -> str:
    parts = urlsplit(url)
    if parts.scheme != "https" and not (allow_http and parts.scheme == "http"):
        raise ValueError("url must be https://")
    if parts.username or parts.password or parts.path not in ("", "/") or parts.query or parts.fragment:
        raise ValueError("url must be a bare origin: no credentials, path, query or fragment")
    return f"{parts.scheme}://{parts.netloc}"


def commits_match(a: str, b: str) -> bool:
    a, b = a.strip().lower(), b.strip().lower()
    return len(a) >= 7 and len(b) >= 7 and bool(re.fullmatch(r"[0-9a-f]+", a)) and (a.startswith(b) or b.startswith(a))


def scan(text: str, patterns: list[str]) -> list[str]:
    return [p for p in patterns if p and p in text]


def verify(origin: str, commit: str, rel: dict) -> dict:
    report = {"url": origin, "expected_commit": commit, "checks": [], "ok": True}

    def record(name, ok, detail):
        report["checks"].append({"check": name, "ok": ok, "detail": detail})
        report["ok"] &= ok

    try:
        status, body = fetch(origin + rel["health_path"])
        served = json.loads(body or b"{}").get("commit", "") if status == 200 else ""
        record("health", commits_match(served, commit), f"status {status}, serving {served or 'nothing'}")
    except (ConnectionError, ValueError) as e:
        record("health", False, str(e))

    for path in as_list(rel["smoke_paths"]):
        try:
            status, _ = fetch(origin + path)
            record(f"smoke {path}", status == 200, f"status {status}")
        except ConnectionError as e:
            record(f"smoke {path}", False, str(e))

    try:
        status, home = fetch(origin + "/")
        html = home.decode("utf-8", errors="replace")
        hits = [f"home page: {p}" for p in scan(html, rel["secret_patterns"])]
        srcs = [urljoin(origin + "/", s) for s in re.findall(r"<script[^>]+src=[\"']([^\"']+)[\"']", html)]
        bundles = [s for s in srcs if urlsplit(s).netloc == urlsplit(origin).netloc][:MAX_BUNDLES]
        for b in bundles:
            _, data = fetch(b)
            hits += [f"{urlsplit(b).path}: {p}" for p in scan(data.decode("utf-8", errors="replace"), rel["secret_patterns"])]
        record("secrets", not hits, f"{len(bundles)} bundles scanned; " + ("; ".join(hits) if hits else "no markers"))
    except ConnectionError as e:
        record("secrets", False, str(e))
    return report


def main(argv=None) -> int:
    ap = parser(__doc__)
    ap.add_argument("--commit", required=True, help="the reviewed commit production should serve")
    ap.add_argument("--url", help="production origin (default .agents/config.toml [release].url)")
    ap.add_argument("--allow-http", action="store_true", help=argparse.SUPPRESS)
    args = ap.parse_args(argv)
    root = root_from(args)
    cfg = load_config(root)
    try:
        origin = check_origin(args.url or cfg["release"]["url"], args.allow_http)
    except ValueError as e:
        print(f"verify_release: {e}")
        return 2
    report = verify(origin, args.commit, cfg["release"])
    report["checked_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    print(json.dumps(report, indent=2))
    receipts = root / cfg["paths"]["reports"] / "deploys.md"
    receipts.parent.mkdir(parents=True, exist_ok=True)
    with receipts.open("a") as f:
        f.write(f"- {report['checked_at']} {origin} expected `{args.commit[:12]}`: {'PASS' if report['ok'] else 'FAIL'}\n")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
