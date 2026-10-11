"""Parallel checkpoints must retain provenance and produce one record per source identity."""

from copy import deepcopy
import hashlib
import json
from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).parent))
from merge import merge
from parse import parse_project


def fixture():
    html = (Path(__file__).parent / "testdata/project.html").read_text(encoding="utf-8")
    record, _ = parse_project(html, "https://devpost.com/software/emergent-b2t1fl", "2026-10-10T20:00:00+00:00")
    return record


def write(path, records):
    path.write_text("".join(json.dumps(r) + "\n" for r in records), encoding="utf-8")
    return path


def test_merge_retains_event_dates_prizes_and_observations_and_is_idempotent(tmp_path):
    older = fixture()
    older["events"][0]["dates"] = "Oct 24 - 26, 2025"
    newer = deepcopy(older)
    newer["fetched_at"] = "2026-10-10T21:00:00+00:00"
    newer["events"][0]["dates"] = None
    newer["events"][0]["prizes"] = []
    newer["description"] += " updated"
    newer["content_hash"] = hashlib.sha256(
        f"{newer['title']}\n{newer['tagline']}\n{newer['description']}".encode()).hexdigest()
    paths = [write(tmp_path / "mac.jsonl", [older]), write(tmp_path / "win.jsonl", [newer])]
    output = tmp_path / "merged.jsonl"
    counts = merge(paths, [], output)
    record = json.loads(output.read_text(encoding="utf-8"))
    assert counts["unique_projects"] == 1 and counts["duplicates_merged"] == 1
    assert record["description"] == newer["description"]
    assert record["events"][0] == older["events"][0]
    assert len(record["observations"]) == 2
    reverse = tmp_path / "reverse.jsonl"
    merge(paths[::-1], [], reverse)
    assert output.read_bytes() == reverse.read_bytes()
    replay = tmp_path / "replay.jsonl"
    merge([output, *paths], [], replay)
    assert output.read_bytes() == replay.read_bytes()


def test_gallery_membership_survives_skipped_project_fetch(tmp_path):
    record = fixture()
    card = {key: record[key] for key in ("id", "url", "title", "tagline", "source", "fetched_at")}
    card.update(detail="summary", event={"name": "Other event", "url": "https://other.devpost.com",
                                        "dates": None, "winner": True})
    output = tmp_path / "merged.jsonl"
    merge([write(tmp_path / "full.jsonl", [record])], [write(tmp_path / "cards.jsonl", [card])], output)
    result = json.loads(output.read_text(encoding="utf-8"))
    assert len(result["events"]) == 2
    assert next(e for e in result["events"] if e["name"] == "Other event")["prizes"] == []
    assert card in result["observations"]  # winner badge is evidence, not an invented prize name


@pytest.mark.parametrize("field,value", [("url", ""), ("id", "wrong"), ("description", ""),
                                         ("source", None), ("content_hash", "wrong")])
def test_invalid_checkpoint_does_not_replace_existing_output(tmp_path, field, value):
    record = fixture()
    record[field] = value
    output = tmp_path / "merged.jsonl"
    output.write_text("previous output")
    with pytest.raises(ValueError):
        merge([write(tmp_path / "bad.jsonl", [record])], [], output)
    assert output.read_text() == "previous output"


def test_refuses_input_overwrite(tmp_path):
    path = write(tmp_path / "input.jsonl", [fixture()])
    with pytest.raises(ValueError, match="overwrite"):
        merge([path], [], path)
