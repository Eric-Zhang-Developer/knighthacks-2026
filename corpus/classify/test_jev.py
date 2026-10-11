"""Decision-provider boundary checks. All synthetic text stays test-only."""
import io
import json
from pathlib import Path
import sys
import urllib.error

import pytest

sys.path.insert(0, str(Path(__file__).parent))
import jev
import run as classifier


def response(payload, overrides=None):
    choices = {"domain": "education", "status": "clear", "dev_tools": "unknown", "evidence": "none",
               "runner_up": "productivity", "kind": "placement", "place": "2", "sponsor": "none"}
    choices.update(overrides or {})
    return {"model": "typesafe/jev-1.13-20260917", "usage": {"cost": 0.0001, "input_tokens": 100},
            "answers": {k: {"type": "choice", "choice": choices[k], "confidence": 0.9,
                "probabilities": {v: float(v == choices[k]) for v in q["criteria"]}}
                for k, q in payload["questions"].items()}}


@pytest.fixture
def record():
    rows = classifier.read_jsonl(classifier.ROOT / "corpus/fixtures/sample.jsonl")
    return {**rows[0], "title": "Test-only teaching tool", "description": "A teaching tool.", "events": []}


@pytest.fixture
def client(tmp_path, monkeypatch):
    c = jev.Jev("test-only-key", tmp_path, concurrency=1)
    monkeypatch.setattr(c, "fetch", lambda encoded: response(json.loads(encoded)))
    return c


def test_cache_preserves_real_model_and_source_binding(client, record, monkeypatch):
    value, model = client.classify("projects", record)
    assert value == {**classifier.UNKNOWN, "domain": "education", "status": "clear"}
    assert model == "typesafe/jev-1.13-20260917"
    monkeypatch.setattr(client, "fetch", lambda _: pytest.fail("cached source must not be paid twice"))
    assert client.classify("projects", record) == (value, model)
    with pytest.raises(BaseException, match="cached source"):
        client.classify("projects", record | {"description": "Different text."})


def test_mixed_asks_runner_up_after_primary(client, record, monkeypatch):
    calls = []
    def fetch(encoded):
        payload = json.loads(encoded)
        calls.append(payload)
        return response(payload, {"status": "mixed"})
    monkeypatch.setattr(client, "fetch", fetch)
    value, _ = client.classify("projects", record)
    assert value["runner_up"] == "productivity"
    assert "runner_up" not in calls[0]["questions"]
    assert "education" not in calls[1]["questions"]["runner_up"]["criteria"]
    assert calls[1]["state"]["source_data"]["primary_domain"] == "education"


@pytest.mark.parametrize("mutation", ["model", "choice", "refusal", "keys", "nan", "probabilities"])
def test_invalid_provider_answer_stays_pending(client, record, monkeypatch, mutation):
    def fetch(encoded):
        raw = response(json.loads(encoded))
        a = raw["answers"]["domain"]
        if mutation == "model": raw["model"] = "different-provider"
        elif mutation == "choice": a["choice"] = "invented"
        elif mutation == "refusal": a["type"] = "refusal"
        elif mutation == "keys": raw["answers"].pop("status")
        elif mutation == "nan": a["confidence"] = float("nan")
        else: a["probabilities"] = {"education": 1}
        return raw
    monkeypatch.setattr(client, "fetch", fetch)
    with pytest.raises(jev.Pending): client.classify("projects", record)


def test_quotes_resolve_exactly_and_summary_cannot_report_use(client, record, monkeypatch):
    row = record | {"description": "We used Copilot to write the tests. Our app teaches math."}
    monkeypatch.setattr(client, "fetch", lambda encoded: response(json.loads(encoded),
        {"dev_tools": "reported", "evidence": "0"}))
    value, _ = client.classify("projects", row)
    assert value["dev_tools_evidence"] == "We used Copilot to write the tests."
    with pytest.raises(jev.Pending, match="tool_evidence_conflict"):
        client.classify("projects", row | {"description": ""})


def test_conflicting_evidence_is_not_silently_downgraded(client, record, monkeypatch):
    row = record | {"description": "We use Gemini in our product."}
    monkeypatch.setattr(client, "fetch", lambda encoded: response(json.loads(encoded), {"evidence": "0"}))
    with pytest.raises(jev.Pending, match="tool_evidence_conflict"):
        client.classify("projects", row)


def test_prize_guessed_placement_is_held(client):
    assert client.classify("prizes", "2nd Place")[0] == {"kind": "placement", "place": 2, "sponsor": None}
    with pytest.raises(jev.Pending, match="placement_downgrade"):
        client.classify("prizes", "First Runner-Up")


def test_pending_not_saved_and_resume_reuses_success(client, record, tmp_path, monkeypatch):
    second = record | {"id": "a" * 40, "description": "Another source."}
    original = client.classify
    def classify(kind, row):
        if row["id"] == second["id"]: raise jev.Pending("refusal")
        return original(kind, row)
    monkeypatch.setattr(client, "classify", classify)
    labels = classifier.Labels(tmp_path / "labels")
    _, _, pending, _, _ = client.label([record, second], labels)
    assert pending == [second["id"]]
    assert set(labels.projects) == {record["id"]}
    assert json.loads((client.dir / "pending.json").read_text())["details"][0]["reason"] == "refusal"
    monkeypatch.setattr(client, "classify", original)
    _, _, pending, _, _ = client.label([record, second], labels)
    assert not pending and len(labels.projects) == 2
    assert labels.projects[second["id"]]["model"] == "typesafe/jev-1.13-20260917"


@pytest.mark.parametrize("code", [400, 401, 402, 403, 404])
def test_fatal_http_stops_without_retry(tmp_path, monkeypatch, code):
    c = jev.Jev("test-only-key", tmp_path)
    def urlopen(*args, **kwargs):
        raise urllib.error.HTTPError(jev.ENDPOINT, code, "not logged", {}, None)
    monkeypatch.setattr(jev.urllib.request, "urlopen", urlopen)
    with pytest.raises(jev.Fatal, match=f"http_{code}"):
        c.fetch(b'{}')
    assert c.calls == 1 and c.stopped.is_set()


def test_rate_limit_retries_once_and_records_usage(tmp_path, monkeypatch):
    c = jev.Jev("test-only-key", tmp_path)
    calls = []
    def urlopen(request, **kwargs):
        calls.append(request)
        if len(calls) == 1:
            raise urllib.error.HTTPError(jev.ENDPOINT, 429, "limited", {"Retry-After": "0"}, None)
        return io.BytesIO(json.dumps({"usage": {"cost": 0.01}, "answers": {}}).encode())
    monkeypatch.setattr(jev.urllib.request, "urlopen", urlopen)
    c.fetch(b'{}')
    assert c.calls == 2 and c.errors["429"] == 1 and c.usage[0]["cost"] == 0.01
    assert all(r.full_url == jev.ENDPOINT for r in calls)


def test_long_retry_after_stops_instead_of_retrying_early(tmp_path, monkeypatch):
    c = jev.Jev("test-only-key", tmp_path)
    def urlopen(*args, **kwargs):
        raise urllib.error.HTTPError(jev.ENDPOINT, 429, "limited", {"Retry-After": "120"}, None)
    monkeypatch.setattr(jev.urllib.request, "urlopen", urlopen)
    with pytest.raises(jev.Fatal, match="retry_after_exceeds_bound"):
        c.fetch(b'{}')
    assert c.calls == 1
