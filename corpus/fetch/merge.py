"""Merge stable collector snapshots, preserving source observations and event memberships.

python corpus/fetch/merge.py mac/projects.jsonl windows/projects.jsonl --output combined.jsonl \
    --summaries mac/summaries.jsonl --summaries windows/summaries.jsonl

Stop/snapshot writers first. Output must differ from every input. No database writes.
"""

import argparse
from copy import deepcopy
from datetime import datetime
import hashlib
import json
from pathlib import Path
import tempfile
from urllib.parse import urlsplit

from parse import PROJECT_URL, canonical


def read(path):
    with path.open(encoding="utf-8-sig") as stream:
        for line in stream:
            if line.strip():
                yield json.loads(line)


def timestamp(value):
    stamp = datetime.fromisoformat(value)
    if stamp.utcoffset() is None:
        raise ValueError("fetched_at requires a timezone")
    return stamp


def identity(record):
    url = canonical(record.get("url", ""))
    if not PROJECT_URL.fullmatch(url) or record.get("id") != hashlib.sha1(url.encode()).hexdigest():
        raise ValueError("invalid project source URL or canonical ID")
    if record.get("source") != "devpost":
        raise ValueError("missing Devpost provenance")
    timestamp(record["fetched_at"])
    return url


def event_url(event):
    url = canonical(event.get("url", ""))
    host = urlsplit(url).hostname or ""
    if not host.endswith(".devpost.com") or not event.get("name"):
        raise ValueError("event requires its source URL and name")
    return url


def union_events(left, right):
    events = {}
    for event in [*left, *right]:
        url = event_url(event)
        previous = events.get(url, {})
        events[url] = {**previous, **event, "url": url,
                       "dates": event.get("dates") or previous.get("dates"),
                       "prizes": sorted(set(previous.get("prizes", [])) | set(event.get("prizes", [])))}
    return [events[url] for url in sorted(events)]


def unique_observations(items):
    # Full observations retain conflicting historic event dates and content hashes without inventing values.
    keyed = {json.dumps(item, sort_keys=True, ensure_ascii=False): item for item in items}
    return [keyed[key] for key in sorted(keyed)]


def merge(inputs, summaries, output):
    paths = [*inputs, *summaries]
    if output.resolve() in {path.resolve() for path in paths}:
        raise ValueError("output must not overwrite an input checkpoint")
    records, total, cards, summary_only = {}, 0, 0, set()
    for path in inputs:
        for raw in read(path):
            record = deepcopy(raw)
            url = identity(record)
            if not record.get("title") or not record.get("description"):
                raise ValueError("full project requires title and description")
            content = f"{record['title']}\n{record.get('tagline') or ''}\n{record['description']}"
            if record.get("content_hash") != hashlib.sha256(content.encode()).hexdigest():
                raise ValueError("project content_hash does not match its text")
            if not isinstance(record.get("technologies"), list) or not isinstance(record.get("events"), list):
                raise ValueError("project requires technologies and events lists")
            observation = {key: record[key] for key in ("url", "source", "fetched_at", "content_hash", "events")}
            record["url"] = url
            record["observations"] = unique_observations(record.get("observations") or [observation])
            record["events"] = union_events([], record["events"])
            previous = records.get(url)
            if previous:
                # Stable tie-breaking means reversing input order cannot change the chosen content.
                key = lambda r: (timestamp(r["fetched_at"]), r["content_hash"], json.dumps(r, sort_keys=True))
                older, newer = sorted([previous, record], key=key)
                record = {**newer, "events": union_events(older["events"], newer["events"]),
                          "observations": unique_observations(older["observations"] + newer["observations"])}
            records[url] = record
            total += 1
    for path in summaries:
        for card in read(path):
            url = identity(card)
            event_url(card["event"])
            if card.get("detail") != "summary":
                raise ValueError("summary input requires detail=summary")
            cards += 1
            if url not in records:
                summary_only.add(url)
                continue  # no invented description: keep summary-only data in its own original snapshot
            record = records[url]
            event = {key: card["event"].get(key) for key in ("name", "url", "dates")}
            record["events"] = union_events(record["events"], [event])
            record["observations"] = unique_observations(record["observations"] + [card])
    if not records:
        raise ValueError("empty corpus: refusing to produce a publication input")
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=output.parent,
                                         suffix=".tmp", delete=False) as stream:
            temporary = Path(stream.name)
            for url in sorted(records):
                stream.write(json.dumps(records[url], ensure_ascii=False, sort_keys=True) + "\n")
        temporary.replace(output)
    finally:
        if temporary:
            temporary.unlink(missing_ok=True)
    result = {"input_records": total, "unique_projects": len(records), "duplicates_merged": total - len(records),
              "gallery_observations": cards, "summary_only_projects": len(summary_only), "output": str(output)}
    print("merge: " + json.dumps(result))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("inputs", nargs="+", type=Path)
    parser.add_argument("--summaries", action="append", default=[], type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    merge(args.inputs, args.summaries, args.output)


if __name__ == "__main__":
    main()
