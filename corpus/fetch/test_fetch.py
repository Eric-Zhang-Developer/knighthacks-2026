"""Parser, dedupe and rejection tests against real Devpost pages saved in testdata/ (no network)."""

import json
import threading
import time
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import run  # noqa: E402
import urllib.error  # noqa: E402

import pytest  # noqa: E402
from parse import canonical, parse_gallery, parse_gallery_cards, parse_project  # noqa: E402

TD = Path(__file__).parent / "testdata"
GALLERY = (TD / "gallery.html").read_text()
PROJECT = (TD / "project.html").read_text()
URL = "https://devpost.com/software/emergent-b2t1fl"


def test_gallery_lists_unique_project_urls():
    urls = parse_gallery(GALLERY, "https://knighthacksviii.devpost.com/project-gallery")
    assert len(urls) == 24 and len(set(urls)) == 24
    assert urls[0] == URL


def test_project_fields_come_from_the_page():
    r, reason = parse_project(PROJECT, URL + "?ref=gallery#x", "t", {"https://knighthacksviii.devpost.com": "Oct 24 - 26, 2025"})
    assert reason is None
    assert (r["url"], r["title"], r["tagline"]) == (URL, "Emergent", "AI Agents for complex human disaster dynamics simulation")
    assert r["technologies"] == ["gemini", "google-adk", "nextjs", "python", "react", "tailwind"]
    assert r["events"] == [{"name": "Knight Hacks VIII", "url": "https://knighthacksviii.devpost.com",
                            "dates": "Oct 24 - 26, 2025",
                            "prizes": ["Best Overall Hack", "Google Cloud Gemini A2A ADK: The Autonomous Agent Challenge"]}]
    assert (r["date"], r["date_kind"]) == ("2025-10-26T09:55:18-04:00", "created")
    assert r["description"].startswith("Inspiration Every emergency manager")
    assert "Built With" not in r["description"]


def test_unknown_event_dates_stay_none():
    r, _ = parse_project(PROJECT, URL, "t")
    assert r["events"][0]["dates"] is None


def test_rejections():
    assert parse_project(PROJECT.replace('id="app-title"', 'id="x"'), URL, "t") == (None, "no title")
    assert parse_project(PROJECT.replace('id="app-details-left"', 'id="x"'), URL, "t") == (None, "no description")


def test_canonical():
    assert canonical("https://DevPost.com/software/a-b/?ref=1#top") == "https://devpost.com/software/a-b"


def test_fetch_dedupes_across_galleries_and_resumes(tmp_path, monkeypatch, capsys):
    """Two galleries list the same project: it's fetched once. A rerun fetches nothing new."""
    monkeypatch.setattr(run, "DATA", tmp_path)
    monkeypatch.setattr(run, "OUT", tmp_path / "projects.jsonl")
    monkeypatch.setattr(run, "REJECTED", tmp_path / "rejected.jsonl")
    monkeypatch.setattr(run, "SUMMARIES", tmp_path / "summaries.jsonl")
    monkeypatch.setattr(run, "PROGRESS", tmp_path / "progress.jsonl")
    sources = tmp_path / "sources.jsonl"
    sources.write_text("".join(json.dumps({"name": n, "url": f"https://{n}.devpost.com", "dates": None,
                                           "gallery": f"https://{n}.devpost.com/project-gallery"}) + "\n" for n in ("a", "b")))
    monkeypatch.setattr(run, "SOURCES", sources)
    page = f'<a href="{URL}">x</a>'
    fetched = []

    class Fake:
        def get(self, url):
            fetched.append(url)
            return PROJECT if "/software/" in url else page if url.endswith("page=1") else ""

    args = type("A", (), {"limit": 0, "deadline": None})
    run.fetch(args, Fake())
    assert [u for u in fetched if "/software/" in u] == [URL]
    assert "deduplicated 1" in capsys.readouterr().out
    assert len((tmp_path / "projects.jsonl").read_text().splitlines()) == 1
    fetched.clear()
    run.fetch(args, Fake())
    assert [u for u in fetched if "/software/" in u] == []


def test_gallery_cards_come_from_the_page():
    cards = parse_gallery_cards(GALLERY, "https://knighthacksviii.devpost.com/project-gallery")
    assert [c["url"] for c in cards] == parse_gallery(GALLERY, "https://knighthacksviii.devpost.com/project-gallery")
    assert cards[0] == {"url": URL, "title": "Emergent",
                        "tagline": "AI Agents for complex human disaster dynamics simulation", "winner": True}


def test_card_without_tagline_or_badge_stays_empty():
    html = '<div class="gallery-item"><a class="link-to-software" href="/software/x-y"><h5> X Y </h5></a></div>'
    assert parse_gallery_cards(html, "https://devpost.com") == [
        {"url": "https://devpost.com/software/x-y", "title": "X Y", "tagline": None, "winner": False}]


def _sources(tmp_path, monkeypatch, names=("a",)):
    for name in ("DATA", "OUT", "REJECTED", "SUMMARIES", "PROGRESS"):
        monkeypatch.setattr(run, name, tmp_path if name == "DATA" else tmp_path / f"{name.lower()}.jsonl")
    src = tmp_path / "sources.jsonl"
    src.write_text("".join(json.dumps({"name": n, "url": f"https://{n}.devpost.com", "dates": "Oct 1 - 2, 2025",
                                       "gallery": f"https://{n}.devpost.com/project-gallery"}) + "\n" for n in names))
    monkeypatch.setattr(run, "SOURCES", src)


def test_gallery_only_writes_summaries_and_skips_project_pages(tmp_path, monkeypatch, capsys):
    _sources(tmp_path, monkeypatch)
    fetched = []

    class Fake:
        def get(self, url):
            fetched.append(url)
            return GALLERY if url.endswith("page=1") else ""

    args = type("A", (), {"limit": 0, "deadline": None, "gallery_only": True})
    run.fetch(args, Fake())
    assert not [u for u in fetched if "/software/" in u]
    rows = [json.loads(line) for line in (tmp_path / "summaries.jsonl").read_text().splitlines()]
    assert len(rows) == 24 and {r["detail"] for r in rows} == {"summary"}
    assert rows[0]["event"] == {"name": "a", "url": "https://a.devpost.com", "dates": "Oct 1 - 2, 2025", "winner": True}
    assert "description" not in rows[0] and not (tmp_path / "out.jsonl").read_text()
    assert "summarized 24" in capsys.readouterr().out
    run.fetch(args, Fake())  # resume: no line written twice
    assert len((tmp_path / "summaries.jsonl").read_text().splitlines()) == 24


def test_full_fetch_also_records_the_cards(tmp_path, monkeypatch):
    _sources(tmp_path, monkeypatch)

    class Fake:
        def get(self, url):
            return PROJECT if "/software/" in url else GALLERY if url.endswith("page=1") else ""

    run.fetch(type("A", (), {"limit": 1, "deadline": None}), Fake())
    assert len((tmp_path / "summaries.jsonl").read_text().splitlines()) == 24
    assert len((tmp_path / "out.jsonl").read_text().splitlines()) == 1


class Clock:
    def __init__(self):
        self.t, self.slept = 100.0, []

    def sleep(self, s):
        self.slept.append(round(s, 3))
        self.t += s

    def __call__(self):
        return self.t


class Response:
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def read(self):
        return b"ok"


def opener(codes, headers=None):
    def open_(req):
        code = codes.pop(0)
        if code == 200:
            return Response()
        raise urllib.error.HTTPError(req.full_url, code, "x", headers, None)
    return open_


def test_two_requests_per_second_by_default():
    c = Clock()
    f = run.Fetcher(sleep=c.sleep, clock=c, opener=opener([200, 200]))
    f.get(URL), f.get(URL)
    assert c.slept == [0.5] and f.rate == "2/s"


def test_first_429_waits_as_asked_then_slows_to_one_per_second():
    c = Clock()
    f = run.Fetcher(sleep=c.sleep, clock=c, opener=opener([429, 200, 200], {"Retry-After": "7"}))
    assert f.get(URL) == "ok"
    assert 7 in c.slept and f.min_interval == 1.0 and f.rate == "1/s after a 429 backoff"
    c.slept.clear()
    f.get(URL)
    assert c.slept == [1.0]


def test_429_without_retry_after_waits_the_default_and_huge_values_are_capped():
    assert run.retry_after(None) == run.BACKOFF_DEFAULT
    assert run.retry_after({"Retry-After": "not a date"}) == run.BACKOFF_DEFAULT
    assert run.retry_after({"Retry-After": "99999"}) == run.BACKOFF_MAX


def test_second_429_or_any_403_stops_the_run():
    c = Clock()
    f = run.Fetcher(sleep=c.sleep, clock=c, opener=opener([429, 429], {"Retry-After": "1"}))
    with pytest.raises(run.Stop):
        f.get(URL)
    with pytest.raises(run.Stop):
        run.Fetcher(sleep=c.sleep, clock=c, opener=opener([403])).get(URL)


def test_rps_above_the_ceiling_is_refused():
    with pytest.raises(SystemExit):
        run.main(["fetch", "--rps", "6"])


def test_release_still_parses_the_stop_line(tmp_path, monkeypatch, capsys):
    """corpus/release/run.py fullmatches the stop line; summaries must not change it."""
    import importlib.util
    release_dir = Path(__file__).parents[1] / "release"
    monkeypatch.syspath_prepend(str(release_dir))  # release/run.py imports its siblings
    spec = importlib.util.spec_from_file_location("release_run", release_dir / "run.py")
    release = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(release)
    _sources(tmp_path, monkeypatch)

    class Fake:
        def get(self, url):
            return PROJECT if "/software/" in url else GALLERY if url.endswith("page=1") else ""

    run.fetch(type("A", (), {"limit": 1, "deadline": None}), Fake())
    counts, stop = release.fetch_counts(capsys.readouterr().out)
    assert stop == "limit" and counts["parsed"] == 1


def test_gallery_only_limit_counts_cards_not_pages(tmp_path, monkeypatch):
    _sources(tmp_path, monkeypatch)

    class Fake:
        def get(self, url):
            return GALLERY if url.endswith("page=1") else ""

    run.fetch(type("A", (), {"limit": 3, "deadline": None, "gallery_only": True}), Fake())
    assert len((tmp_path / "summaries.jsonl").read_text().splitlines()) == 3


def test_retry_after_as_an_http_date():
    from datetime import datetime, timezone
    now = datetime(2026, 10, 21, 7, 27, 30, tzinfo=timezone.utc)
    assert run.retry_after({"Retry-After": "Wed, 21 Oct 2026 07:28:00 GMT"}, now) == 30
    assert run.retry_after({"Retry-After": "Wed, 21 Oct 2026 07:28:00 GMT"}, now.replace(microsecond=900000)) == 30


def test_backoff_that_would_pass_the_deadline_stops_instead():
    from datetime import datetime, timedelta, timezone
    c = Clock()
    f = run.Fetcher(sleep=c.sleep, clock=c, opener=opener([429, 200], {"Retry-After": "120"}))
    f.deadline = datetime.now(timezone.utc) + timedelta(seconds=30)
    with pytest.raises(run.Stop, match="deadline"):
        f.get(URL)
    assert 120 not in c.slept


def test_no_request_after_the_deadline_even_when_pacing_crosses_it():
    from datetime import datetime, timedelta, timezone
    c = Clock()
    f = run.Fetcher(rps=0.5, sleep=c.sleep, clock=c, opener=opener([200, 200]))
    f.get(URL)
    f.deadline = datetime.now(timezone.utc) - timedelta(seconds=1)
    with pytest.raises(run.Stop, match="deadline"):
        f.get(URL)


def test_workers_overlap_project_pages_and_write_in_page_order(tmp_path, monkeypatch):
    for name, path in (("DATA", tmp_path), ("OUT", tmp_path / "projects.jsonl"), ("REJECTED", tmp_path / "rejected.jsonl"),
                       ("SUMMARIES", tmp_path / "summaries.jsonl"), ("PROGRESS", tmp_path / "progress.jsonl")):
        monkeypatch.setattr(run, name, path)
    sources = tmp_path / "sources.jsonl"
    sources.write_text(json.dumps({"name": "a", "url": "https://a.devpost.com", "dates": None,
                                   "gallery": "https://a.devpost.com/project-gallery"}) + "\n")
    monkeypatch.setattr(run, "SOURCES", sources)
    urls = [f"https://devpost.com/software/p{i}" for i in range(5)]
    page = "".join(f'<a href="{u}">x</a>' for u in urls)
    lock, state = threading.Lock(), {"now": 0, "max": 0}

    class Fake:
        def get(self, url):
            if "/software/" not in url:
                return page if url.endswith("page=1") else ""
            with lock:
                state["now"] += 1
                state["max"] = max(state["max"], state["now"])
            time.sleep(0.05 if url != urls[0] else 0.15)  # the first page answers last
            with lock:
                state["now"] -= 1
            return PROJECT

    run.fetch(type("A", (), {"limit": 0, "deadline": None, "workers": 5}), Fake())
    assert state["max"] > 1
    assert [json.loads(line)["url"] for line in (tmp_path / "projects.jsonl").read_text().splitlines()] == urls


def test_a_429_already_in_flight_when_the_backoff_began_is_not_a_second_429():
    c = Clock()
    f = run.Fetcher(sleep=c.sleep, clock=c, opener=opener([429, 200]))
    f.backed_off, f.backoff_started = True, c.t + 1000  # another worker's 429 started the backoff after we sent
    assert f.get(URL) == "ok"


def _paged(fetched, pages=2, stop_on=None):
    """Source a's gallery has `pages` pages of one distinct project each; page `stop_on` raises Stop mid-page."""
    class Fake:
        def get(self, url):
            fetched.append(url)
            if "/software/" in url:
                if stop_on and url.endswith(f"p{stop_on}"):
                    raise run.Stop("403")
                return PROJECT
            n = int(url.rsplit("page=", 1)[1])
            return f'<a href="https://devpost.com/software/p{n}">x</a>' if n <= pages else ""
    return Fake()


def test_a_rerun_skips_gallery_pages_already_handled(tmp_path, monkeypatch):
    _sources(tmp_path, monkeypatch, names=("a", "b"))
    fetched = []
    args = type("A", (), {"limit": 0, "deadline": None})
    run.fetch(args, _paged(fetched))
    assert len([u for u in fetched if "/software/" in u]) == 2  # p1, p2 (both sources list the same two)
    fetched.clear()
    run.fetch(args, _paged(fetched))
    assert fetched == []  # both sources complete: not one gallery request
    fetched.clear()
    run.fetch(type("A", (), {"limit": 0, "deadline": None, "rewalk": True}), _paged(fetched))
    assert any("page=1" in u for u in fetched) and not [u for u in fetched if "/software/" in u]


def test_a_stop_mid_page_redoes_that_page_and_not_the_ones_before(tmp_path, monkeypatch):
    _sources(tmp_path, monkeypatch)
    fetched = []
    args = type("A", (), {"limit": 0, "deadline": None})
    run.fetch(args, _paged(fetched, pages=3, stop_on=2))  # page 1 handled; page 2's project page gets a 403
    fetched.clear()
    run.fetch(args, _paged(fetched, pages=3))
    assert fetched[0].endswith("page=2")  # resumes at the page that was cut short, not page 1
    assert [u for u in fetched if "/software/" in u] == ["https://devpost.com/software/p2", "https://devpost.com/software/p3"]


def test_a_limit_cut_page_is_redone(tmp_path, monkeypatch):
    _sources(tmp_path, monkeypatch)

    class Fake:
        def get(self, url):
            return PROJECT if "/software/" in url else GALLERY if url.endswith("page=1") else ""

    run.fetch(type("A", (), {"limit": 1, "deadline": None}), Fake())  # 1 of the page's 24 projects
    assert not (tmp_path / "progress.jsonl").read_text()
    run.fetch(type("A", (), {"limit": 0, "deadline": None}), Fake())
    assert len((tmp_path / "out.jsonl").read_text().splitlines()) == 24


def test_gallery_only_progress_does_not_let_a_full_run_skip_projects(tmp_path, monkeypatch):
    _sources(tmp_path, monkeypatch)
    fetched = []
    run.fetch(type("A", (), {"limit": 0, "deadline": None, "gallery_only": True}), _paged(fetched))
    fetched.clear()
    run.fetch(type("A", (), {"limit": 0, "deadline": None, "gallery_only": True}), _paged(fetched))
    assert fetched == []  # gallery-only rerun skips it
    run.fetch(type("A", (), {"limit": 0, "deadline": None}), _paged(fetched))
    assert [u for u in fetched if "/software/" in u] == ["https://devpost.com/software/p1", "https://devpost.com/software/p2"]


def test_a_page_cut_short_by_the_limit_is_not_skipped_by_a_later_page(tmp_path, monkeypatch):
    """Codex: --limit truncates page 1 (its first project is rejected, so the run goes on); page 2 then finishes.
    A rerun must start at page 1 again, not page 3."""
    _sources(tmp_path, monkeypatch)
    pages = {1: ["bad", "b"], 2: ["c"]}

    class Fake:
        def get(self, url):
            if "/software/" in url:
                return "<html></html>" if url.endswith("/bad") else PROJECT
            n = int(url.rsplit("page=", 1)[1])
            return "".join(f'<a href="https://devpost.com/software/{s}">x</a>' for s in pages.get(n, []))

    run.fetch(type("A", (), {"limit": 1, "deadline": None}), Fake())
    assert not (tmp_path / "progress.jsonl").read_text()


def test_an_empty_reply_after_a_full_page_does_not_complete_the_source(tmp_path, monkeypatch):
    _sources(tmp_path, monkeypatch)
    fetched = []

    class Fake:
        def __init__(self, empty):
            self.empty = empty

        def get(self, url):
            fetched.append(url)
            if "/software/" in url:
                return PROJECT
            return "" if self.empty or not url.endswith("page=1") else GALLERY

    run.fetch(type("A", (), {"limit": 0, "deadline": None}), Fake(empty=True))  # a transient empty first page
    fetched.clear()
    run.fetch(type("A", (), {"limit": 0, "deadline": None}), Fake(empty=False))
    assert fetched[0].endswith("page=1")  # asked again
    fetched.clear()
    run.fetch(type("A", (), {"limit": 0, "deadline": None}), Fake(empty=False))
    assert fetched == ["https://a.devpost.com/project-gallery?page=2"]  # a full page then empty: one request, not complete


def test_projects_dropped_by_the_limit_are_not_seen_by_a_later_gallery(tmp_path, monkeypatch):
    """Codex: source a's page lists [bad, x]; --limit 1 drops x. Source b lists x: b's page mustn't be recorded."""
    _sources(tmp_path, monkeypatch, names=("a", "b"))
    pages = {"a": ["bad", "x"], "b": ["x"]}

    class Fake:
        def get(self, url):
            if "/software/" in url:
                return "<html></html>" if url.endswith("/bad") else PROJECT
            name, n = url.split("//")[1].split(".")[0], int(url.rsplit("page=", 1)[1])
            return "".join(f'<a href="https://devpost.com/software/{s}">x</a>' for s in pages[name]) if n == 1 else ""

    run.fetch(type("A", (), {"limit": 1, "deadline": None}), Fake())
    assert len((tmp_path / "out.jsonl").read_text().splitlines()) == 1  # b fetched x
    assert [(r["source"], r["page"]) for r in run.read_jsonl(tmp_path / "progress.jsonl")] == [("https://b.devpost.com", 1)]


def test_a_repeated_page_right_after_a_restart_is_still_caught(tmp_path, monkeypatch):
    """Codex: the run stops after page 1; on restart page 2 returns page 1's links. It mustn't be recorded."""
    _sources(tmp_path, monkeypatch)

    class Fake:
        def get(self, url):
            return PROJECT if "/software/" in url else GALLERY

    run.fetch(type("A", (), {"limit": 24, "deadline": None}), Fake())  # page 1 done, then the limit
    run.fetch(type("A", (), {"limit": 0, "deadline": None}), Fake())  # page 2 repeats page 1
    assert [r["page"] for r in run.read_jsonl(tmp_path / "progress.jsonl")] == [1]


def test_isolated_collector_skips_other_machine_projects_and_keeps_cards(tmp_path, monkeypatch):
    _sources(tmp_path, monkeypatch)
    known = tmp_path / "mac.jsonl"
    second = parse_gallery(GALLERY, "https://knighthacksviii.devpost.com/project-gallery")[1]
    known.write_text(json.dumps({"url": URL + "?ref=gallery"}) + "\n" +
                     json.dumps({"id": run.hashlib.sha1(second.encode()).hexdigest()}) + "\n")
    isolated = tmp_path / "windows"
    requests = []

    class Fake:
        def get(self, url):
            requests.append(url)
            return GALLERY if url.endswith("page=1") else "" if "page=" in url else PROJECT

    # fetch uses isinstance for production deadlines; keep that type check working.
    class FakeFetcher(Fake):
        def __init__(self, rps):
            self.rate = f"{rps}/s"
    monkeypatch.setattr(run, "Fetcher", FakeFetcher)
    args = ["fetch", "--sources", str(run.SOURCES), "--data-dir", str(isolated),
            "--exclude-projects", str(known), "--rps", "5", "--workers", "5"]
    assert run.main(args) == 0
    assert URL not in requests and second not in requests
    assert len(run.read_jsonl(isolated / "projects.jsonl")) == 22
    assert len(run.read_jsonl(isolated / "summaries.jsonl")) == 24
    assert not run.OUT.exists()  # default output was not touched
    requests.clear()
    run.main(args)
    assert not [url for url in requests if "/software/" in url]
    assert len(run.read_jsonl(isolated / "projects.jsonl")) == 22


def test_missing_external_checkpoint_fails_before_requests(tmp_path, monkeypatch):
    _sources(tmp_path, monkeypatch)
    args = type("A", (), {"exclude_projects": [tmp_path / "missing.jsonl"]})
    with pytest.raises(ValueError, match="missing known-project"):
        run.fetch(args, object())
