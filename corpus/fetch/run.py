"""Fetch real past hackathon projects from Devpost into corpus/data/projects.jsonl.

  python corpus/fetch/run.py discover [--pages 20] [--min-registrations 200] [--search TEXT]
                                                         add ended hackathons to sources.jsonl
  python corpus/fetch/run.py fetch [--limit N] [--deadline ISO] [--rps 2] [--gallery-only]
                                                         walk galleries, fetch project pages

Every gallery page's cards (title, tagline, winner badge) also go to corpus/data/summaries.jsonl, one line per
project per event, at no extra request. --gallery-only stops there: ~24 projects per request instead of one.

Polite by construction: at most --rps requests per second (2 at most), one retry, and every source is on
devpost.com. The first 429 waits as asked (Retry-After, else 60 s) and drops to 1 request per second for the rest
of the run; a second 429, or any 403, stops the run. Rerunning resumes: work already written is skipped.
"""

import argparse
import hashlib
import json
import math
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

from parse import canonical, parse_gallery, parse_gallery_cards, parse_project

HERE = Path(__file__).resolve().parent
DATA = HERE.parent / "data"
SOURCES = HERE / "sources.jsonl"  # committed: which galleries we read, and why
OUT, REJECTED, SUMMARIES = DATA / "projects.jsonl", DATA / "rejected.jsonl", DATA / "summaries.jsonl"
# Standard crawler UA format (like Googlebot's); Devpost's CDN refuses urllib's default bare headers.
UA = "Mozilla/5.0 (compatible; uncharted-knighthacks-research; +https://github.com/Eric-Zhang-Developer/knighthacks-2026)"
HEADERS = {"User-Agent": UA, "Accept": "*/*"}
API = "https://devpost.com/api/hackathons?status[]=ended&order_by=recently-added&page={page}"
MAX_RPS = 2.0  # Devpost publishes no limit and robots.txt sets no crawl delay; this is our own ceiling
BACKOFF_DEFAULT, BACKOFF_MAX = 60, 300  # seconds to wait on a 429 without, or with too long, a Retry-After


class Stop(Exception):
    """The host asked us to stop (403/429); end the run."""


def retry_after(headers, now=None) -> int:
    """Seconds a 429 asks us to wait: Retry-After as seconds or an HTTP date, clamped to 1..BACKOFF_MAX; missing or
    unreadable waits BACKOFF_DEFAULT."""
    value = headers.get("Retry-After") if headers else None
    try:
        seconds = int(value)
    except (TypeError, ValueError):
        try:
            seconds = math.ceil((parsedate_to_datetime(value) - (now or datetime.now(timezone.utc))).total_seconds())
        except (TypeError, ValueError):
            return BACKOFF_DEFAULT
    return min(max(seconds, 1), BACKOFF_MAX)


class Fetcher:
    def __init__(self, rps=MAX_RPS, sleep=time.sleep, clock=time.monotonic, opener=None):
        self.min_interval, self.last, self.backed_off = 1.0 / rps, 0.0, False
        self.deadline: datetime | None = None  # a backoff never sleeps past it
        self.sleep, self.clock = sleep, clock
        self.open = opener or (lambda req: urllib.request.urlopen(req, timeout=30))

    @property
    def rate(self) -> str:
        return f"{1 / self.min_interval:g}/s" + (" after a 429 backoff" if self.backed_off else "")

    def get(self, url: str) -> str:
        attempt = 0
        while True:
            attempt += 1
            wait = self.last + self.min_interval - self.clock()
            if wait > 0:
                self.sleep(wait)
            if self.deadline and datetime.now(timezone.utc) >= self.deadline:
                raise Stop("deadline")  # pacing or a backoff can carry us past it; never request after it
            self.last = self.clock()
            try:
                with self.open(urllib.request.Request(url, headers=HEADERS)) as r:
                    return r.read().decode("utf-8", "replace")
            except urllib.error.HTTPError as e:
                if e.code == 429 and not self.backed_off:
                    # Once per run: wait as asked, then stay at 1 request per second. Losing the whole night's
                    # fetch to one 429 costs more than a minute's pause.
                    self.backed_off, self.min_interval = True, max(self.min_interval, 1.0)
                    wait = retry_after(e.headers)
                    if self.deadline and datetime.now(timezone.utc) + timedelta(seconds=wait) >= self.deadline:
                        raise Stop(f"HTTP 429 on {url}; its {wait} s backoff would pass the deadline") from e
                    self.sleep(wait)
                    attempt -= 1  # the backoff isn't the one retry
                    continue
                if e.code in (403, 429):
                    raise Stop(f"HTTP {e.code} on {url}") from e
                if e.code < 500 or attempt == 2:
                    raise
            except urllib.error.URLError:
                if attempt == 2:
                    raise


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


def summary_record(card: dict, src: dict, fetched_at: str) -> dict:
    """A gallery card as a record: only what the card shows. `detail: summary` marks that there's no description."""
    return {
        "id": hashlib.sha1(card["url"].encode()).hexdigest(),
        "url": card["url"],
        "title": card["title"],
        "tagline": card["tagline"],
        "event": {"name": src["name"], "url": src["url"], "dates": src.get("dates"), "winner": card["winner"]},
        "detail": "summary",
        "source": "devpost",
        "fetched_at": fetched_at,
        "content_hash": hashlib.sha256(f"{card['title']}\n{card['tagline'] or ''}".encode()).hexdigest(),
    }


def fetch(args, f: Fetcher) -> int:
    DATA.mkdir(parents=True, exist_ok=True)
    sources = read_jsonl(SOURCES)
    event_dates = {s["url"]: s.get("dates") for s in sources}
    done = {r["url"] for r in read_jsonl(OUT)} | {r["url"] for r in read_jsonl(REJECTED)}
    have_summary = {(r["url"], r["event"]["url"]) for r in read_jsonl(SUMMARIES)}
    gallery_only = getattr(args, "gallery_only", False)
    deadline = datetime.fromisoformat(args.deadline) if args.deadline else None
    # The stop line's format is parsed by corpus/release/run.py: summaries are counted apart and printed on their
    # own line so that line stays byte-for-byte what release expects.
    counts = {"discovered": 0, "fetched": 0, "parsed": 0, "deduplicated": 0, "written": 0}
    summarized = 0
    if isinstance(f, Fetcher):
        f.deadline = deadline
    rejected: dict[str, int] = {}
    seen: set[str] = set()
    stop_reason = "frontier exhausted"

    def out_of_time() -> bool:
        return bool(deadline and datetime.now(timezone.utc) >= deadline)

    def at_limit() -> bool:
        return bool(args.limit and (summarized if gallery_only else counts["written"]) >= args.limit)

    try:
        with OUT.open("a") as out, REJECTED.open("a") as rej, SUMMARIES.open("a") as summ:
            for src in sources:
                prev: list[str] = []
                for page in range(1, 10_000):
                    if out_of_time() or at_limit():
                        raise StopIteration
                    html = f.get(f"{src['gallery']}?page={page}")
                    urls = parse_gallery(html, src["gallery"])
                    if not urls or urls == prev:  # past the last page, or pagination repeating
                        break
                    prev = urls
                    for card in parse_gallery_cards(html, src["gallery"]):
                        if gallery_only and at_limit():
                            break
                        if (card["url"], src["url"]) not in have_summary:
                            have_summary.add((card["url"], src["url"]))
                            summ.write(json.dumps(summary_record(card, src, now())) + "\n")
                            summarized += 1
                    summ.flush()
                    if gallery_only:
                        continue
                    for url in urls:
                        if url in seen or url in done:
                            counts["deduplicated"] += url in seen  # the same project in another gallery
                            seen.add(url)
                            continue
                        seen.add(url)
                        counts["discovered"] += 1
                        if out_of_time() or at_limit():
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
    rate = f" at {f.rate}" if isinstance(f, Fetcher) else ""
    print(f"fetch: summarized {summarized} gallery cards{rate}")
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
    fe.add_argument("--rps", type=float, default=MAX_RPS, help=f"requests per second, at most {MAX_RPS:g}")
    fe.add_argument("--gallery-only", action="store_true",
                    help="write gallery cards to summaries.jsonl and skip project pages (--limit counts summaries)")
    args = ap.parse_args(argv)
    rps = getattr(args, "rps", MAX_RPS)
    if not 0 < rps <= MAX_RPS:
        ap.error(f"--rps must be above 0 and at most {MAX_RPS:g}")
    f = Fetcher(rps)
    if args.cmd == "discover":
        discover(args, f)
        return 0
    return fetch(args, f)


if __name__ == "__main__":
    sys.exit(main())
