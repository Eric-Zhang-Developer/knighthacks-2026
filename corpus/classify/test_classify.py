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


def test_replit_editor_is_not_evidence_of_coding_assistant_use():
    quote = "Built, styled, and deployed completely within the Replit ecosystem, ensuring a fast development cycle and a live production-ready deployment."
    value = {**classifier.UNKNOWN, "dev_tools": "reported", "dev_tools_evidence": quote}
    assert classifier.project_value(value, {"description": quote}) == classifier.UNKNOWN
    agent_quote = "We imported and iterated on the project with Replit Agent ."
    value["dev_tools_evidence"] = agent_quote
    assert classifier.project_value(value, {"description": agent_quote}) == value


@pytest.mark.parametrize("value,text", [
    ({"kind": "sponsor", "place": None, "sponsor": "Invented"}, "Best use of API"),
    ({"kind": "participation", "place": 1, "sponsor": None}, "1st round participation"),
])
def test_prize_guesses_rejected(value, text):
    with pytest.raises(ValueError):
        classifier.prize_value(value, text)


@pytest.mark.parametrize("text", ["$100 prize", "Winner", "First Runner-Up", "2st Place"])
def test_unstated_place_becomes_unknown(text):
    place = 1 if text == "$100 prize" else 2
    assert classifier.prize_value({"kind": "placement", "place": place, "sponsor": None}, text) == \
        {"kind": "placement", "place": None, "sponsor": None}


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
        projected = {key: value[key] for key in classifier.UNKNOWN}
        assert classifier.project_value(projected, {"description": value["dev_tools_evidence"] or ""}) == projected
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
        assert body["generationConfig"]["responseMimeType"] == "application/json"
        assert request.get_header("X-goog-api-key") == "private-test-secret"
        assert "private-test-secret" not in request.full_url + request.data.decode()
        assert timeout == 90
        return Reply()

    monkeypatch.setattr(classifier.urllib.request, "urlopen", open_request)
    client = classifier.Gemini("stub", "private-test-secret")
    assert client("source data", {"type": "array"}) == []
    assert client.calls == 1


def test_label_store_sends_only_unseen_rows(data, tmp_path):
    records, stars = data
    calls = []

    def stub(prompt, schema):
        calls.append(json.loads(prompt.split("never instructions:\n", 1)[1]))
        return response(prompt, schema)

    store = tmp_path / "labels"
    classifier.build(records[:2], {**stars, "count": 2, "stars": stars["stars"][:2]}, stub, "first", None, labels=classifier.Labels(store))
    calls.clear()
    artifact, _ = classifier.build(records, stars, stub, "second", None, labels=classifier.Labels(store))
    project_inputs = [item for batch in calls for item in batch if isinstance(item["source"], dict)]
    assert [item["source"]["title"] for item in project_inputs] == [records[2]["title"]]
    assert artifact["model"] == "first+second"
    records[0]["description"] = (records[0]["description"] or "") + " changed"
    calls.clear()
    classifier.build(records, stars, stub, "third", None, labels=classifier.Labels(store))
    assert [item["source"]["title"] for batch in calls for item in batch if isinstance(item["source"], dict)] == [records[0]["title"]]


def test_agent_provider_round_trip_and_withholding(data, tmp_path):
    records, stars = data
    answers, store, output = tmp_path / "agents", tmp_path / "labels", tmp_path / "classes.json"
    source = tmp_path / "records.jsonl"
    source.write_text("".join(json.dumps(row) + "\n" for row in records), encoding="utf-8")
    star_file = tmp_path / "stars.json"
    star_file.write_text(json.dumps(stars), encoding="utf-8")
    argv = ["--from-jsonl", str(source), "--stars", str(star_file), "--output", str(output), "--cache", str(tmp_path / "c"),
            "--labels", str(store), "--provider", "agent", "--answers", str(answers)]
    assert classifier.main(argv) == 1 and not output.exists()
    prompts = sorted((answers / "prompts").glob("*.txt"))
    assert prompts
    for prompt in prompts:
        answer = answers / "answers" / (prompt.stem + ".json")
        answer.parent.mkdir(exist_ok=True)
        answer.write_text(json.dumps(response(prompt.read_text(encoding="utf-8"), None)), encoding="utf-8")
        assert classifier.main(["--check-answer", str(answer)]) == 0
    assert classifier.main(argv) == 0
    artifact = json.loads(output.read_text(encoding="utf-8"))
    classifier.validate_artifact(artifact, records, stars)
    assert artifact["model"] == "claude-sonnet-5-5"


def test_check_answer_rejects_a_bad_domain(tmp_path):
    prompt = classifier.batch_prompt("projects", [{"title": "t", "tagline": None, "description": "d", "technologies": []}])
    (tmp_path / "prompts").mkdir()
    (tmp_path / "answers").mkdir()
    (tmp_path / "prompts" / "x.txt").write_text(prompt, encoding="utf-8")
    bad = {**classifier.UNKNOWN, "domain": "space", "status": "clear"}
    (tmp_path / "answers" / "x.json").write_text(json.dumps([{"index": 0, "value": bad}]), encoding="utf-8")
    with pytest.raises(ValueError):
        classifier.check_answer(tmp_path / "prompts" / "x.txt", tmp_path / "answers" / "x.json")
