"""Golden test against the real database and Inference API: needs DATABASE_URL and HF_TOKEN (.env.local)."""

import json
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))
import run  # noqa: E402

run.load_env()
FIXTURE = [json.loads(line) for line in (run.ROOT / "corpus" / "fixtures" / "sample.jsonl").read_text().splitlines()][:5]


def test_keys_present():
    missing = [k for k in ("DATABASE_URL", "HF_TOKEN", "EMBED_MODEL") if not os.environ.get(k)]
    assert not missing, f"set {missing} in .env.local"


def test_own_title_finds_the_record_first():
    import psycopg

    queries = run.embed([r["title"] for r in FIXTURE])
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
        for r, q in zip(FIXTURE, queries):
            cur.execute("select id, title from projects order by embedding <=> %s::vector limit 1",
                        ("[" + ",".join(f"{x:.7f}" for x in q) + "]",))
            top = cur.fetchone()
            assert top[0] == r["id"], f"query {r['title']!r} returned {top[1]!r} first"


def test_stars_match_the_table():
    import psycopg

    stars = json.loads(run.STARS.read_text())
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
        cur.execute("select count(*), min(corpus_version), max(corpus_version) from projects")
        count, lo, hi = cur.fetchone()
    assert stars["count"] == len(stars["stars"]) == count
    assert lo == hi == stars["corpus_version"]
