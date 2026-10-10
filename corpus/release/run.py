"""Resume the full fetch, embed/load it, and validate the resulting release.

    python corpus/release/run.py --deadline <ISO-time-with-offset>

Run with the existing corpus/embed environment plus corpus/fetch requirements.
An optional --fetch-python uses a separate existing fetch environment. The fetch
resumes corpus/data/projects.jsonl and rejected.jsonl in THIS checkout; copy the
existing checkpoint here first if it lives in a different worktree. Do not copy
or consume a checkpoint while another fetch is writing it.

This writes to DATABASE_URL: use the approved production destination only after
one-way-door approval. No Git commit or deployment is performed. After success,
publish stars.json through the separate fix(corpus-embed) PR required by the spec.
Fetch counters describe this invocation; indexed/displayed describe the entire
resulting corpus. Earlier fetch counters are unknown unless their logs were kept.
"""

import argparse
import ast
import json
import re
import subprocess
import sys
from pathlib import Path
from datetime import datetime

from check import check_database

ROOT = Path(__file__).resolve().parents[2]


def fetch_counts(output: str) -> tuple[dict, str]:
    lines = [line for line in output.splitlines() if line.startswith("fetch: stopped (")]
    if len(lines) != 1:
        raise ValueError("expected one fetch summary; counts are unknown")
    match = re.fullmatch(
        r"fetch: stopped \((.*)\); discovered (\d+), fetched (\d+), parsed (\d+), "
        r"deduplicated (\d+), written (\d+), rejected (\d+)(?: (\{.*\}))?", lines[0])
    if not match:
        raise ValueError("unrecognized fetch summary; counts are unknown")
    stop, discovered, fetched, parsed, deduplicated, written, rejected, reasons = match.groups()
    reasons = ast.literal_eval(reasons) if reasons else {}
    if not isinstance(reasons, dict) or any(type(v) is not int or v < 0 for v in reasons.values()):
        raise ValueError("invalid rejection counts")
    if sum(reasons.values()) != int(rejected) or parsed != written:
        raise ValueError("inconsistent fetch counts")
    return {"discovered": int(discovered), "fetched": int(fetched), "parsed": int(parsed),
            "rejected": {"count": int(rejected), "by_reason": reasons},
            "deduplicated": int(deduplicated)}, stop


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--deadline", required=True, help="fetch deadline, ISO time with offset")
    ap.add_argument("--fetch-python", default=sys.executable)
    args = ap.parse_args(argv)
    if datetime.fromisoformat(args.deadline).utcoffset() is None:
        raise ValueError("deadline must include a timezone offset")
    # Import before starting the potentially long fetch so missing dependencies fail early.
    sys.path.insert(0, str(ROOT))
    from corpus.embed import run as embedding

    embedding.load_env()
    import os
    if any(not os.environ.get(k) for k in ("DATABASE_URL", "HF_TOKEN", "EMBED_MODEL")):
        raise ValueError("DATABASE_URL, HF_TOKEN and EMBED_MODEL must be set")
    fetched = subprocess.run([args.fetch_python, str(ROOT / "corpus/fetch/run.py"),
                              "fetch", "--deadline", args.deadline],
                             cwd=ROOT, text=True, stdout=subprocess.PIPE, check=True)
    # Never load or announce a release without reliable counters and a nonempty input.
    counts, stop = fetch_counts(fetched.stdout)
    records = [json.loads(line) for line in (ROOT / "corpus/data/projects.jsonl").read_text().splitlines()
               if line.strip()]
    if not records or any(not r.get("id") or not r.get("url") for r in records):
        raise ValueError("empty corpus or record without id/source URL; do not load")
    if embedding.main([]) != 0:
        raise RuntimeError("embedding/load failed; do not publish")
    count, version = check_database(ROOT / "public/corpus/stars.json")
    counts.update(indexed=count, displayed=count)
    print("release: " + json.dumps({"fetch_scope": "this invocation", **counts,
                                  "corpus_version": version, "fetch_stop": stop}), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
