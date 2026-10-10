"""Fetch real past hackathon projects from Devpost into corpus/data/projects.jsonl.

  python corpus/fetch/run.py discover [--pages 20] [--min-registrations 200] [--search TEXT]
                                                         add ended hackathons to sources.jsonl
  python corpus/fetch/run.py fetch [--limit N] [--deadline ISO]                 walk galleries, fetch project pages

Polite by construction: at most one request per second, one retry, and the run stops on 403/429 (every source
is on devpost.com). Rerunning resumes: project URLs already written or rejected are skipped.
"""

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from parse import canonical, parse_gallery, parse_project

HERE = Path(__file__).resolve().parent
DATA = HERE.parent / "data"
SOURCES = HERE / "sources.jsonl"  # committed: which galleries we read, and why
OUT, REJECTED = DATA / "projects.jsonl", DATA / "rejected.jsonl"
# Standard crawler UA format (like Googlebot's); Devpost's CDN refuses urllib's default bare headers.
UA = "Mozilla/5.0 (compatible; uncharted-knighthacks-research; +https://github.com/Eric-Zhang-Developer/knighthacks-2026)"
HEADERS = {"User-Agent": UA, "Accept": "*/*"}
API = "https://devpost.com/api/hackathons?status[]=ended&order_by=recently-added&page={page}"


class Stop(Exception):
    """The host asked us to stop (403/429); end the run."""


class Fetcher:
    def __init__(self, min_interval=1.0):
        self.min_interval, self.last = min_interval, 0.0

    def get(self, url: str) -> str:
        for attempt in (1, 2):  # one retry
            wait = self.last + self.min_interval - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            self.last = time.monotonic()
            try:
                req = urllib.request.Request(url, headers=HEADERS)
                with urllib.request.urlopen(req, timeout=30) as r:
                    return r.read().decode("utf-8", "replace")
            except urllib.error.HTTPError as e:
                if e.code in (403, 429):
                    raise Stop(f"HTTP {e.code} on {url}") from e
                if e.code < 500 or attempt == 2:
                    raise
            except urllib.error.URLError:
                if attempt == 2:
                    raise
        raise AssertionError("unreachable")


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()] if path.exists() else []


def discover(args, f: Fetcher) -> None:
    have = {s["url"] for s in read_jsonl(SOURCES)}
    added = 0
    with SOURCES.open("a") as out:
        for page in range(1, args.pages + 1):
            url = API.format(page=page) + (f"&search={urllib.parse.quote(args.search)}" if args.search else "")
            hackathons = json.loads(f.get(url)).get("hackathons", [])
            if not hackathons:
                break
            for h in hackathons:
                url = canonical(h["url"])
                if url in have or (h.get("registrations_count") or 0) < args.min_registrations:
                    continue
                have.add(url)
                added += 1
                out.write(json.dumps({"name": h["title"], "url": url, "gallery": h["submission_gallery_url"],
                                      "dates": h.get("submission_period_dates"),
                                      "registrations": h.get("registrations_count")}) + "\n")
    print(f"discover: added {added} sources, {len(have)} total in {SOURCES.name}")


def fetch(args, f: Fetcher) -> int:
    DATA.mkdir(parents=True, exist_ok=True)
    sources = read_jsonl(SOURCES)
    event_dates = {s["url"]: s.get("dates") for s in sources}
    done = {r["url"] for r in read_jsonl(OUT)} | {r["url"] for r in read_jsonl(REJECTED)}
    deadline = datetime.fromisoformat(args.deadline) if args.deadline else None
    counts = {"discovered": 0, "fetched": 0, "parsed": 0, "deduplicated": 0, "written": 0}
    rejected: dict[str, int] = {}
    seen: set[str] = set()
    stop_reason = "frontier exhausted"

    def out_of_time() -> bool:
        return bool(deadline and datetime.now(timezone.utc) >= deadline)

    try:
        with OUT.open("a") as out, REJECTED.open("a") as rej:
            for src in sources:
                prev: list[str] = []
                for page in range(1, 10_000):
                    if out_of_time() or (args.limit and counts["written"] >= args.limit):
                        raise StopIteration
                    urls = parse_gallery(f.get(f"{src['gallery']}?page={page}"), src["gallery"])
                    if not urls or urls == prev:  # past the last page, or pagination repeating
                        break
                    prev = urls
                    for url in urls:
                        if url in seen or url in done:
                            counts["deduplicated"] += url in seen  # the same project in another gallery
                            seen.add(url)
                            continue
                        seen.add(url)
                        counts["discovered"] += 1
                        if out_of_time() or (args.limit and counts["written"] >= args.limit):
                            raise StopIteration
                        try:
                            html = f.get(url)
                        except (urllib.error.URLError, TimeoutError) as e:
                            reason = f"fetch failed: {getattr(e, 'code', type(e).__name__)}"
                        else:
                            counts["fetched"] += 1
                            record, reason = parse_project(html, url, now(), event_dates)
                            if record:
                                counts["parsed"] += 1
                                out.write(json.dumps(record) + "\n")
                                out.flush()
                                counts["written"] += 1
                                continue
                        rejected[reason] = rejected.get(reason, 0) + 1
                        rej.write(json.dumps({"url": url, "reason": reason, "at": now()}) + "\n")
    except StopIteration:
        stop_reason = "deadline" if out_of_time() else "limit"
    except Stop as e:
        stop_reason = str(e)
    print(f"fetch: stopped ({stop_reason}); " + ", ".join(f"{k} {v}" for k, v in counts.items())
          + f", rejected {sum(rejected.values())} {rejected or ''}".rstrip())
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("discover")
    d.add_argument("--pages", type=int, default=20, help="API pages to read (9 hackathons each)")
    d.add_argument("--min-registrations", type=int, default=200)
    d.add_argument("--search", help="only hackathons matching this text, e.g. \"knight hacks\"")
    fe = sub.add_parser("fetch")
    fe.add_argument("--limit", type=int, default=0, help="stop after writing this many records (0 = no limit)")
    fe.add_argument("--deadline", help="ISO time with offset; stop when it passes")
    args = ap.parse_args(argv)
    f = Fetcher()
    if args.cmd == "discover":
        discover(args, f)
        return 0
    return fetch(args, f)


if __name__ == "__main__":
    sys.exit(main())
