"""Parser, dedupe and rejection tests against real Devpost pages saved in testdata/ (no network)."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import run  # noqa: E402
from parse import canonical, parse_gallery, parse_project  # noqa: E402

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
