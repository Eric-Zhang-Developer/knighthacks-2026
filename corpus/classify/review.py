"""Prepare reproducible source samples for agent review; this does not grade its own output."""
import argparse
import hashlib
import json
from pathlib import Path
import random

from run import DOMAINS, ROOT, validate_artifact, write_json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=Path(__file__).parent / ".cache")
    args = parser.parse_args()
    artifact_path = ROOT / "public/classify/classes.json"
    source_path = args.cache / "source.json"
    artifact = json.loads(artifact_path.read_text(encoding="utf-8"))
    source = json.loads(source_path.read_text(encoding="utf-8"))
    stars = json.loads((ROOT / "public/corpus/stars.json").read_text(encoding="utf-8"))
    validate_artifact(artifact, source, stars)
    records = {row["id"]: row for row in source}
    projects = artifact["projects"]
    rng = random.Random(artifact["corpus_version"])
    groups = {"random": rng.sample(sorted(projects), min(50, len(projects)))}
    for domain, _ in DOMAINS:
        ids = sorted(key for key, value in projects.items() if value["domain"] == domain)
        groups[domain] = rng.sample(ids, min(3, len(ids)))
    uncertain = sorted(key for key, value in projects.items() if value["status"] in {"mixed", "insufficient_text"})
    groups["uncertain"] = rng.sample(uncertain, min(20, len(uncertain)))
    selected = sorted({key for ids in groups.values() for key in ids})
    prizes = {prize["text"]: {key: prize[key] for key in ("kind", "place", "sponsor")}
              for value in projects.values() for prize in value["prizes"]}
    pack = {"artifact_sha256": hashlib.sha256(artifact_path.read_bytes()).hexdigest(),
            "source_sha256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
            "groups": groups, "projects": {key: {"source": records[key], "classification": projects[key]} for key in selected},
            "distinct_prizes": prizes}
    write_json(args.cache / "review-pack.json", pack)
    print(f"review: {len(selected)} distinct source samples, {len(prizes)} distinct prizes; no review verdict assigned")


if __name__ == "__main__":
    main()
