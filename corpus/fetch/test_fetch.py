"""Parser, dedupe and rejection tests against real Devpost pages saved in testdata/ (no network)."""

import json
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
    for name in ("DATA", "OUT", "REJECTED", "SUMMARIES"):
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
        run.main(["fetch", "--rps", "3"])


def test_release_still_parses_the_stop_line(tmp_path, monkeypatch, capsys):
    """corpus/release/run.py fullmatches the stop line; summaries must not change it."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("release_run", Path(__file__).parents[1] / "release" / "run.py")
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


def test_backoff_that_would_pass_the_deadline_stops_instead():
    from datetime import datetime, timedelta, timezone
    c = Clock()
    f = run.Fetcher(sleep=c.sleep, clock=c, opener=opener([429, 200], {"Retry-After": "120"}))
    f.deadline = datetime.now(timezone.utc) + timedelta(seconds=30)
    with pytest.raises(run.Stop, match="deadline"):
        f.get(URL)
    assert 120 not in c.slept
