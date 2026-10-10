"""Validate a star bundle against the projects table (read-only).

    python corpus/release/check.py [--stars public/corpus/stars.json]

Uses the existing corpus/embed dependencies and .env.local loader.
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def validate(bundle: dict, rows: list[dict]) -> tuple[int, str]:
    stars = bundle["stars"]
    count, version = bundle["count"], bundle["corpus_version"]
    if type(count) is not int or count <= 0 or count != len(stars) or count != len(rows):
        raise ValueError("count mismatch or empty corpus")
    if not isinstance(version, str) or not version.strip():
        raise ValueError("missing corpus_version")
    for name, records in (("stars", stars), ("projects", rows)):
        ids = [r.get("id") for r in records]
        if any(not isinstance(i, str) or not i.strip() for i in ids):
            raise ValueError(f"missing id in {name}")
        if len(set(ids)) != len(ids):
            raise ValueError(f"duplicate id in {name}")
    if {s["id"] for s in stars} != {r["id"] for r in rows}:
        raise ValueError("star/project ids differ")
    if any(not isinstance(r.get("url"), str) or not r["url"].strip() for r in rows):
        raise ValueError("missing source url")
    if any(r.get("corpus_version") != version for r in rows):
        raise ValueError("split corpus_version")
    return count, version


def check_database(stars: Path) -> tuple[int, str]:
    import os
    import psycopg
    from psycopg.rows import dict_row

    bundle = json.loads(stars.read_text())
    with psycopg.connect(os.environ["DATABASE_URL"], row_factory=dict_row) as conn:
        conn.execute("SET TRANSACTION READ ONLY")
        rows = conn.execute("select id, url, corpus_version from projects").fetchall()
    return validate(bundle, rows)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--stars", type=Path, default=ROOT / "public/corpus/stars.json")
    args = ap.parse_args(argv)
    sys.path.insert(0, str(ROOT))
    from corpus.embed.run import load_env

    load_env()
    try:
        count, version = check_database(args.stars)
    except (ValueError, KeyError, TypeError) as exc:
        print(f"release check: FAILED ({exc})", file=sys.stderr)
        return 1
    print(f"release check: count {count}, corpus_version {version}, passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
