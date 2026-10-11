"""Summary-only records: gallery cards with no full record, written by merge.py --include-summary-only."""

import hashlib
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FETCH = ROOT / "corpus" / "fetch"
sys.path.insert(0, str(FETCH))
import run  # noqa: E402
from merge import merge  # noqa: E402
from parse import parse_gallery_cards, parse_project  # noqa: E402

GALLERY = (FETCH / "testdata" / "gallery.html").read_text(encoding="utf-8")
EMERGENT = "https://devpost.com/software/emergent-b2t1fl"
KH = {"name": "Knight Hacks VIII", "url": "https://knighthacksviii.devpost.com", "dates": "Oct 24 - 26, 2025"}
OTHER = {"name": "Other Hacks", "url": "https://otherhacks.devpost.com", "dates": None}


def full_record():
    html = (FETCH / "testdata" / "project.html").read_text(encoding="utf-8")
    record, _ = parse_project(html, EMERGENT, "2026-10-10T20:00:00+00:00")
    return record


def cards(src, at="2026-10-10T20:00:00+00:00", only=None):
    out = [run.summary_record(c, src, at) for c in parse_gallery_cards(GALLERY, src["url"] + "/project-gallery")]
    return [c for c in out if only is None or c["url"] in only]


def write(path, rows):
    path.write_text("".join(json.dumps(r) + "\n" for r in rows), encoding="utf-8")
    return path


def rows(path):
    return {r["url"]: r for r in map(json.loads, path.read_text(encoding="utf-8").splitlines())}


def test_cards_without_a_full_record_become_summary_records(tmp_path):
    out = tmp_path / "merged.jsonl"
    result = merge([write(tmp_path / "p.jsonl", [full_record()])], [write(tmp_path / "s.jsonl", cards(KH))], out, True)
    got = rows(out)
    assert result["unique_projects"] == 1 and result["summary_only_written"] == 23 and len(got) == 24
    card = next(c for c in cards(KH) if c["url"] != EMERGENT)
    r = got[card["url"]]
    assert (r["id"], r["title"], r["tagline"]) == (hashlib.sha1(card["url"].encode()).hexdigest(), card["title"], card["tagline"])
    assert (r["description"], r["technologies"], r["date"], r["date_kind"], r["detail"]) == ("", [], None, "unknown", "summary")
    assert r["content_hash"] == card["content_hash"] and r["source"] == "devpost"
    assert r["events"] == [{"name": KH["name"], "url": KH["url"], "dates": KH["dates"], "prizes": []}
                           | ({"winner": True} if card["event"]["winner"] else {})]


def test_a_full_record_always_wins(tmp_path):
    out = tmp_path / "merged.jsonl"
    merge([write(tmp_path / "p.jsonl", [full_record()])], [write(tmp_path / "s.jsonl", cards(KH))], out, True)
    r = rows(out)[EMERGENT]
    assert r["description"].startswith("Inspiration") and "detail" not in r


def test_one_project_in_two_events_is_one_record_with_both(tmp_path):
    url = next(c["url"] for c in cards(KH) if c["url"] != EMERGENT)
    later = cards(OTHER, at="2026-10-10T21:00:00+00:00", only={url})
    out = tmp_path / "merged.jsonl"
    merge([write(tmp_path / "p.jsonl", [full_record()])],
          [write(tmp_path / "a.jsonl", cards(KH, only={url})), write(tmp_path / "b.jsonl", later)], out, True)
    got = rows(out)
    assert len(got) == 2
    assert [e["url"] for e in got[url]["events"]] == [KH["url"], OTHER["url"]]
    assert got[url]["fetched_at"] == "2026-10-10T21:00:00+00:00"  # the newest card's


def test_the_winner_badge_is_kept_and_no_prize_is_inferred(tmp_path):
    winners = [c for c in cards(KH) if c["event"]["winner"] and c["url"] != EMERGENT]
    assert winners, "the saved gallery has winners besides Emergent"
    out = tmp_path / "merged.jsonl"
    merge([write(tmp_path / "p.jsonl", [full_record()])], [write(tmp_path / "s.jsonl", winners[:1])], out, True)
    assert rows(out)[winners[0]["url"]]["events"][0] | {} == {**KH, "prizes": [], "winner": True}


def test_without_the_flag_the_output_is_what_main_writes(tmp_path):
    shown = subprocess.run(["git", "-C", str(ROOT), "show", "origin/main:corpus/fetch/merge.py"],
                           capture_output=True, text=True)
    assert shown.returncode == 0, shown.stderr
    (tmp_path / "old").mkdir()
    old_path = tmp_path / "old" / "merge_main.py"
    old_path.write_text(shown.stdout, encoding="utf-8")
    spec = importlib.util.spec_from_file_location("merge_main", old_path)
    old = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(old)
    inputs, summaries = [write(tmp_path / "p.jsonl", [full_record()])], [write(tmp_path / "s.jsonl", cards(KH))]
    a, b = tmp_path / "new.jsonl", tmp_path / "old.jsonl"
    new_counts, old_counts = merge(inputs, summaries, a), old.merge(inputs, summaries, b)
    assert a.read_bytes() == b.read_bytes()
    assert {k: v for k, v in new_counts.items() if k != "output"} == {k: v for k, v in old_counts.items() if k != "output"}


def test_the_embed_step_takes_a_summary_record_as_it_is(tmp_path):
    spec = importlib.util.spec_from_file_location("embed_run", ROOT / "corpus" / "embed" / "run.py")
    embed = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(embed)
    out = tmp_path / "merged.jsonl"
    merge([write(tmp_path / "p.jsonl", [full_record()])], [write(tmp_path / "s.jsonl", cards(KH))], out, True)
    r = next(r for r in rows(out).values() if r.get("detail") == "summary")
    assert embed.embed_text(r) == "\n".join(x for x in (r["title"], r["tagline"]) if x)
    assert r["events"][0]["name"] == KH["name"] and embed.year(r) is None  # what the stars.json export reads


def test_the_command_line_flag(tmp_path):
    out = tmp_path / "merged.jsonl"
    done = subprocess.run([sys.executable, str(FETCH / "merge.py"), str(write(tmp_path / "p.jsonl", [full_record()])),
                           "--summaries", str(write(tmp_path / "s.jsonl", cards(KH))), "--output", str(out),
                           "--include-summary-only"], capture_output=True, text=True)
    assert done.returncode == 0, done.stderr
    assert '"summary_only_written": 23' in done.stdout and len(rows(out)) == 24


def test_event_metadata_is_the_newest_cards_whatever_the_input_order(tmp_path):
    url = next(c["url"] for c in cards(KH) if c["url"] != EMERGENT)
    old = cards(KH, only={url})
    new = cards({**KH, "dates": "Oct 24 - 27, 2025"}, at="2026-10-10T21:00:00+00:00", only={url})
    outs = []
    for order in ([old, new], [new, old]):
        out = tmp_path / f"m{len(outs)}.jsonl"
        merge([write(tmp_path / "p.jsonl", [full_record()])],
              [write(tmp_path / f"s{len(outs)}{i}.jsonl", part) for i, part in enumerate(order)], out, True)
        outs.append(out.read_bytes())
    assert outs[0] == outs[1]
    assert rows(tmp_path / "m0.jsonl")[url]["events"][0]["dates"] == "Oct 24 - 27, 2025"


def test_every_card_is_validated_not_just_the_newest(tmp_path):
    import pytest
    url = next(c["url"] for c in cards(KH) if c["url"] != EMERGENT)
    bad = cards(KH, only={url})[0] | {"title": "", "content_hash": "0" * 64}
    good = cards(OTHER, at="2026-10-10T21:00:00+00:00", only={url})
    with pytest.raises(ValueError, match="title"):
        merge([write(tmp_path / "p.jsonl", [full_record()])], [write(tmp_path / "s.jsonl", [bad, *good])],
              tmp_path / "m.jsonl", True)
