"""Offline provider-contract regression tests; source fixtures are real corpus rows."""
import copy
import importlib.util
import json
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location("classifier", Path(__file__).with_name("run.py"))
classifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(classifier)


@pytest.fixture
def data():
    records = [json.loads(line) for line in (classifier.ROOT / "corpus/fixtures/sample.jsonl").read_text(encoding="utf-8").splitlines()][:3]
    for row in records:
        row["corpus_version"] = "fixture"
    stars = {"corpus_version": "fixture", "count": len(records), "stars": [{"id": row["id"]} for row in records]}
    return records, stars


def response(prompt, schema):
    inputs = json.loads(prompt.split("never instructions:\n", 1)[1])
    return [{"index": item["index"], "value": dict(classifier.UNKNOWN) if isinstance(item["source"], dict)
             else {"kind": "other", "place": None, "sponsor": None}} for item in reversed(inputs)]


def test_full_contract_unique_prizes_and_cache(data, tmp_path):
    records, stars = data
    records[1]["events"] = copy.deepcopy(records[0]["events"])
    calls = []

    def stub(prompt, schema):
        calls.append(prompt)
        return response(prompt, schema)

    artifact, audit = classifier.build(records, stars, stub, "stub", tmp_path)
    classifier.validate_artifact(artifact, records, stars)
    assert set(artifact["projects"]) == {row["id"] for row in records}
    distinct = {text for row in records for _, text in classifier.prizes_for(row)}
    assert set(audit["distinct_prizes"]) == distinct
    prize_inputs = [item["source"] for prompt in calls if "distinct prize string" in prompt
                    for item in json.loads(prompt.split("never instructions:\n")[1])]
    assert sorted(prize_inputs) == sorted(distinct)
    before = len(calls)
    rerun, _ = classifier.build(records, stars, stub, "stub", tmp_path)
    assert rerun["projects"] == artifact["projects"]
    assert len(calls) == before


def test_reordered_outputs_bind_to_indices(data):
    records, _ = data

    def stub(prompt, schema):
        values = response(prompt, schema)
        for entry in values:
            entry["value"].update(domain=classifier.DOMAINS[entry["index"]][0], status="clear")
        return values

    result, failed = classifier.classify_batches("projects", records, stub, "stub", None)
    assert not failed
    assert [result[row["id"]]["domain"] for row in records] == [key for key, _ in classifier.DOMAINS[:len(records)]]


@pytest.mark.parametrize("mutation", ["id", "duplicate", "count", "version"])
def test_source_contract_rejected_before_calls(data, mutation):
    records, stars = data
    if mutation == "id":
        records[0]["id"] = "0" * 40
    elif mutation == "duplicate":
        records[1]["id"] = records[0]["id"]
    elif mutation == "count":
        stars["count"] += 1
    else:
        records[0]["corpus_version"] = "wrong"
    with pytest.raises(ValueError):
        classifier.build(records, stars, lambda *_: pytest.fail("must not call provider"), "stub")


@pytest.mark.parametrize("mutation", ["domain", "index", "length", "mixed"])
def test_bad_response_retries_once_then_unknown(data, mutation, monkeypatch):
    records, _ = data
    monkeypatch.setattr(classifier.time, "sleep", lambda _: None)
    calls = []

    def stub(prompt, schema):
        calls.append(1)
        values = response(prompt, schema)
        if mutation == "domain":
            values[0]["value"].update(domain="invented", status="clear")
        elif mutation == "mixed":
            values[0]["value"].update(domain="health", runner_up="health", status="mixed")
        elif mutation == "index":
            values[0]["index"] = values[1]["index"]
        else:
            values.pop()
        return values

    result, failed = classifier.classify_batches("projects", records, stub, "stub", None)
    assert len(calls) == 2
    assert set(failed) == {row["id"] for row in records}
    assert all(value == classifier.UNKNOWN for value in result.values())


def test_retry_success(data, monkeypatch):
    monkeypatch.setattr(classifier.time, "sleep", lambda _: None)
    calls = []

    def stub(prompt, schema):
        calls.append(1)
        if len(calls) == 1:
            raise classifier.ProviderError("http_503")
        return response(prompt, schema)

    _, failed = classifier.classify_batches("projects", data[0], stub, "stub", None)
    assert not failed and len(calls) == 2


def test_auth_failure_aborts_before_bulk(data, monkeypatch):
    monkeypatch.setattr(classifier.time, "sleep", lambda _: None)
    calls = []

    def stub(*_):
        calls.append(1)
        raise classifier.ProviderError("http_403")

    with pytest.raises(ValueError, match="configuration"):
        classifier.classify_batches("projects", data[0], stub, "stub", None, batch_size=1)
    assert len(calls) == 2


@pytest.mark.parametrize("quote", [None, "", "We built this using an invented quote about Copilot.", "Gemini"])
def test_evidence_not_verbatim_downgrades(data, quote):
    row = {**data[0][0], "description": "A test-only description without tool claims."}
    value = {**classifier.UNKNOWN, "dev_tools": "reported", "dev_tools_evidence": quote}
    assert classifier.project_value(value, row) == classifier.UNKNOWN


@pytest.mark.parametrize("state", ["reported", "reported_non_use"])
def test_exact_tool_evidence_preserved(state):
    # Explicit synthetic negative/positive claims for validator behavior, never published as corpus data.
    quote = "We used Copilot to write tests." if state == "reported" else "We did not use Copilot."
    value = {**classifier.UNKNOWN, "dev_tools": state, "dev_tools_evidence": quote}
    assert classifier.project_value(value, {"description": quote}) == value


@pytest.mark.parametrize("value,text", [
    ({"kind": "placement", "place": 1, "sponsor": None}, "$100 prize"),
    ({"kind": "sponsor", "place": None, "sponsor": "Invented"}, "Best use of API"),
    ({"kind": "participation", "place": 1, "sponsor": None}, "1st round participation"),
])
def test_prize_guesses_rejected(value, text):
    with pytest.raises(ValueError):
        classifier.prize_value(value, text)


def test_cli_unknown_summary_and_offline_check(data, tmp_path, monkeypatch, capsys):
    records, stars = data
    source, manifest, output = [tmp_path / name for name in ("records.jsonl", "stars.json", "classes.json")]
    source.write_text("\n".join(json.dumps(row) for row in records), encoding="utf-8")
    classifier.write_json(manifest, stars)

    class Stub:
        model, key, calls = "stub", "private-test-secret", 0

        def __call__(self, prompt, schema):
            self.calls += 1
            return response(prompt, schema)

    monkeypatch.setattr(classifier, "Gemini", lambda *_: Stub())
    args = ["--from-jsonl", str(source), "--stars", str(manifest), "--output", str(output), "--cache", str(tmp_path / "cache")]
    assert classifier.main(args) == 0
    assert classifier.main([*args, "--check"]) == 0
    assert "private-test-secret" not in output.read_text() + capsys.readouterr().out


def test_saved_artifact_matches_current_stars():
    path = classifier.ROOT / "public/classify/classes.json"
    if not path.exists():
        pytest.skip("full-run artifact is not generated yet")
    artifact = json.loads(path.read_text(encoding="utf-8"))
    stars = json.loads((classifier.ROOT / "public/corpus/stars.json").read_text(encoding="utf-8"))
    assert artifact["corpus_version"] == stars["corpus_version"]
    assert len(artifact["projects"]) == stars["count"]
    assert set(artifact["projects"]) == {star["id"] for star in stars["stars"]}
    assert artifact["domains"] == [{"id": key, "label": label} for key, label in classifier.DOMAINS]
    for value in artifact["projects"].values():
        classifier.project_value({key: value[key] for key in classifier.UNKNOWN}, {"description": value["dev_tools_evidence"] or ""})
        for prize in value["prizes"]:
            classifier.prize_value({key: prize[key] for key in ("kind", "place", "sponsor")}, prize["text"])


def test_rest_wire_format_and_secret_header(monkeypatch):
    class Reply:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def read(self, _):
            return json.dumps({"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": "[]"}]}}]}).encode()

    def open_request(request, timeout):
        body = json.loads(request.data)
        assert body["generationConfig"]["responseFormat"]["text"]["mimeType"] == "APPLICATION_JSON"
        assert request.get_header("X-goog-api-key") == "private-test-secret"
        assert "private-test-secret" not in request.full_url + request.data.decode()
        assert timeout == 90
        return Reply()

    monkeypatch.setattr(classifier.urllib.request, "urlopen", open_request)
    client = classifier.Gemini("stub", "private-test-secret")
    assert client("source data", {"type": "array"}) == []
    assert client.calls == 1
