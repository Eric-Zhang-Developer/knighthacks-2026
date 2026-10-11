"""Offline failure recovery checks; real fixture text, test-only vectors/provider."""

import json
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np
import pytest
from requests.exceptions import Timeout

sys.path.insert(0, str(Path(__file__).parent))
import run

RECORDS = [json.loads(line) for line in (run.ROOT / "corpus/fixtures/sample.jsonl").read_text().splitlines()][:20]


def test_silent_provider_times_out_after_one_retry(monkeypatch):
    release = threading.Event()
    requests = []

    class SilentProvider(BaseHTTPRequestHandler):
        def do_POST(self):
            self.rfile.read(int(self.headers["Content-Length"]))
            requests.append(self.path)
            release.wait(5)

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), SilentProvider)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    monkeypatch.setenv("HF_TOKEN", "local-test-token")
    monkeypatch.setenv("EMBED_MODEL", f"http://127.0.0.1:{server.server_port}")
    monkeypatch.setattr(run, "REQUEST_TIMEOUT", 0.1)
    monkeypatch.setattr(run.time, "sleep", lambda _: None)
    try:
        with pytest.raises(Timeout):
            run.embed([run.embed_text(RECORDS[0])])
        assert len(requests) == 2
    finally:
        release.set()
        server.shutdown()
        server.server_close()
        thread.join()


def test_resume_keeps_successful_batches_after_later_failure(tmp_path, monkeypatch):
    monkeypatch.setattr(run, "CACHE", tmp_path / "embeddings.npz")
    calls = []

    later, failed = [run.embed_text(r) for r in RECORDS[run.BATCH:]], []

    # Batches run concurrently, so the failing one is named by its texts, not by call order.
    def fail_second_batch(texts):
        calls.append(texts)
        if texts == later and not failed:
            failed.append(texts)
            raise TimeoutError("test provider outage")
        return np.full((len(texts), 1024), 1 / 32, dtype=np.float32)

    monkeypatch.setattr(run, "embed", fail_second_batch)
    with pytest.raises(TimeoutError):
        run.cached_embeddings(RECORDS)
    with np.load(run.CACHE) as cache:
        assert cache["hashes"].tolist() == [r["content_hash"] for r in RECORDS[:run.BATCH]]
    calls.clear()
    vectors = run.cached_embeddings(RECORDS)
    assert calls == [[run.embed_text(r) for r in RECORDS[run.BATCH:]]]
    assert vectors.shape == (len(RECORDS), 1024)
    with np.load(run.CACHE) as cache:
        assert len(cache["hashes"]) == len(RECORDS)


def test_failed_checkpoint_keeps_previous_cache_readable(tmp_path, monkeypatch):
    monkeypatch.setattr(run, "CACHE", tmp_path / "embeddings.npz")
    monkeypatch.setattr(run, "embed", lambda texts: np.full((len(texts), 1024), 1 / 32, dtype=np.float32))
    run.cached_embeddings(RECORDS[:1])
    original = run.CACHE.read_bytes()

    def fail_save(path, **kwargs):
        Path(path).write_bytes(b"interrupted test checkpoint")
        raise OSError("test disk failure")

    monkeypatch.setattr(run.np, "savez", fail_save)
    with pytest.raises(OSError):
        run.cached_embeddings(RECORDS[:2])
    assert run.CACHE.read_bytes() == original
    with np.load(run.CACHE) as cache:
        assert cache["hashes"].tolist() == [RECORDS[0]["content_hash"]]
