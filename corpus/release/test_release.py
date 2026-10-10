"""Release gate checks use real fixture records; malformed copies must be rejected."""

import copy
import importlib.util
import json
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from check import validate  # noqa: E402

# Other corpus tests use a module named run; don't accidentally import one of those.
spec = importlib.util.spec_from_file_location("release_runner", HERE / "run.py")
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


@pytest.fixture
def corpus():
    root = HERE.parents[1]
    fixture = [json.loads(line) for line in (root / "corpus/fixtures/sample.jsonl").read_text().splitlines()][:3]
    version = "fixture-validation"
    rows = [{"id": r["id"], "url": r["url"], "corpus_version": version} for r in fixture]
    return {"count": len(rows), "corpus_version": version, "stars": [{"id": r["id"]} for r in rows]}, rows


def test_matching_bundle(corpus):
    assert validate(*corpus) == (3, "fixture-validation")


@pytest.mark.parametrize("damage,reason", [
    ("count", "count mismatch"), ("url", "missing source url"),
    ("version", "split corpus_version"), ("star_duplicate", "duplicate id"),
    ("row_duplicate", "duplicate id"), ("wrong_ids", "ids differ"),
])
def test_rejects_corrupt_bundle(corpus, damage, reason):
    bundle, rows = copy.deepcopy(corpus)
    if damage == "count": bundle["count"] += 1
    elif damage == "url": rows[0]["url"] = ""
    elif damage == "version": rows[0]["corpus_version"] = "wrong"
    elif damage == "star_duplicate": bundle["stars"][1] = bundle["stars"][0]
    elif damage == "row_duplicate": rows[1] = rows[0]
    elif damage == "wrong_ids": bundle["stars"][0]["id"] = "not-a-project"
    with pytest.raises(ValueError, match=reason):
        validate(bundle, rows)


def test_refuses_empty_release():
    with pytest.raises(ValueError, match="empty corpus"):
        validate({"count": 0, "corpus_version": "empty", "stars": []}, [])


def test_fetch_counts_are_per_invocation_and_preserve_rejection_reasons():
    counts, stop = runner.fetch_counts("fetch: stopped (HTTP 429 on https://devpost.com); discovered 4, "
        "fetched 3, parsed 2, deduplicated 1, written 2, rejected 1 {'no title': 1}\n")
    assert counts == {"discovered": 4, "fetched": 3, "parsed": 2, "deduplicated": 1,
                      "rejected": {"count": 1, "by_reason": {"no title": 1}}}
    assert stop == "HTTP 429 on https://devpost.com"


@pytest.mark.parametrize("summary", ["", "fetch: stopped (unknown)",
    "fetch: stopped (deadline); discovered 2, fetched 2, parsed 1, deduplicated 0, written 1, rejected 2 {'no title': 1}"])
def test_unknown_or_inconsistent_counts_block_publication(summary):
    with pytest.raises(ValueError):
        runner.fetch_counts(summary)


@pytest.mark.parametrize("gate_fails", [False, True])
def test_runner_prints_release_only_after_database_gate(tmp_path, monkeypatch, capsys, corpus, gate_fails):
    from types import SimpleNamespace
    from corpus.embed import run as embedding

    bundle, rows = corpus
    data = tmp_path / "corpus/data"
    data.mkdir(parents=True)
    (data / "projects.jsonl").write_text("\n".join(json.dumps(row) for row in rows))
    monkeypatch.setattr(runner, "ROOT", tmp_path)
    for key in ("DATABASE_URL", "HF_TOKEN", "EMBED_MODEL"):
        monkeypatch.setenv(key, "test-only")
    monkeypatch.setattr(embedding, "load_env", lambda: None)
    calls = []
    monkeypatch.setattr(embedding, "main", lambda args: calls.append("load") or 0)
    monkeypatch.setattr(runner.subprocess, "run", lambda *args, **kwargs: SimpleNamespace(stdout=
        "fetch: stopped (deadline); discovered 0, fetched 0, parsed 0, deduplicated 0, written 0, rejected 0"))

    def gate(path):
        calls.append("check")
        assert path == tmp_path / "public/corpus/stars.json"
        if gate_fails:
            raise ValueError("count mismatch")
        return validate(bundle, rows)

    monkeypatch.setattr(runner, "check_database", gate)
    if gate_fails:
        with pytest.raises(ValueError, match="count mismatch"):
            runner.main(["--deadline", "2026-10-10T12:00:00+00:00"])
        assert "release:" not in capsys.readouterr().out
    else:
        assert runner.main(["--deadline", "2026-10-10T12:00:00+00:00"]) == 0
        output = json.loads(capsys.readouterr().out.removeprefix("release: "))
        assert output["indexed"] == output["displayed"] == 3
        assert output["parsed"] == 0  # resumed records are not newly parsed records
        assert output["fetch_scope"] == "this invocation"
    assert calls == ["load", "check"]
