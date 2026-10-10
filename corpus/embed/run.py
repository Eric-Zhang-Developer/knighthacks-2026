"""Embed corpus records, project them to 3D, load them into Neon and export public/corpus/stars.json.

  python corpus/embed/run.py [--input corpus/data/projects.jsonl] [--no-load]

Embeddings come from the Hugging Face Inference API (EMBED_MODEL, hf-inference), the same endpoint the app uses at
request time, so stored vectors and query vectors match by construction. They're cached by content hash in
corpus/data/embeddings.npz, so a rerun pays only for new or changed records.
The table is replaced as a whole: after a load it holds exactly this run's records, and stars.json has the same count.
"""

import argparse
import json
import os
import sys
import time
from datetime import date
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CACHE = ROOT / "corpus" / "data" / "embeddings.npz"
STARS = ROOT / "public" / "corpus" / "stars.json"
MAX_CHARS = 2000  # the opening of a description (inspiration, what it does) carries the meaning; cost grows with length
BATCH = 16
REQUEST_TIMEOUT = 60  # seconds without a provider response, per attempt
SEED = 42
GROUP_SIZE, GROUPS_MAX = 140, 200  # about 140 projects per system: 60 systems at 8,409
SPREAD, TIGHTEN = 3.0, 0.3  # systems sit 3x further apart; each shrinks to under a third of its UMAP size


def load_env() -> None:
    """Fill missing env vars from the repo's .env.local (KEY=VALUE lines), without overriding real ones."""
    env = ROOT / ".env.local"
    if env.exists():
        for line in env.read_text().splitlines():
            key, sep, val = line.partition("=")
            if sep and not key.startswith("#") and val and key.strip() not in os.environ:
                os.environ[key.strip()] = val.strip()


def embed_text(r: dict) -> str:
    return "\n".join(x for x in (r["title"], r.get("tagline"), r["description"]) if x)[:MAX_CHARS]


def embed(texts: list[str]) -> np.ndarray:
    """Normalized float32 vectors, one per text, from the Inference API. One retry per batch."""
    from huggingface_hub import InferenceClient

    client = InferenceClient(provider="hf-inference", api_key=os.environ["HF_TOKEN"], timeout=REQUEST_TIMEOUT)
    out = []
    for i in range(0, len(texts), BATCH):
        for attempt in (1, 2):
            try:
                out.append(np.asarray(client.feature_extraction(texts[i:i + BATCH], model=os.environ["EMBED_MODEL"]),
                                      dtype=np.float32))
                break
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(5)
        print(f"embed: {min(i + BATCH, len(texts))}/{len(texts)}", flush=True)
    v = np.concatenate(out).reshape(len(texts), -1)
    return v / np.linalg.norm(v, axis=1, keepdims=True)


def cached_embeddings(records: list[dict]) -> np.ndarray:
    cache: dict[str, np.ndarray] = {}
    if CACHE.exists():
        with np.load(CACHE) as z:
            cache = dict(zip(z["hashes"].tolist(), z["vectors"]))
    todo = [r for r in records if r["content_hash"] not in cache]
    print(f"embed: {len(records) - len(todo)} cached, {len(todo)} to embed", flush=True)
    for start in range(0, len(todo), BATCH):
        batch = todo[start:start + BATCH]
        for r, v in zip(batch, embed([embed_text(r) for r in batch])):
            cache[r["content_hash"]] = v
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        checkpoint = CACHE.with_suffix(".tmp.npz")
        np.savez(checkpoint, hashes=np.array(list(cache)), vectors=np.stack(list(cache.values())))
        checkpoint.replace(CACHE)
        print(f"embed: checkpointed {min(start + BATCH, len(todo))}/{len(todo)} new records", flush=True)
    return np.stack([cache[r["content_hash"]] for r in records])


def systems(vectors: np.ndarray, xyz: np.ndarray) -> np.ndarray:
    """Group by meaning, then spread the groups apart and tighten each one, so the galaxy reads as star systems.

    Plain UMAP of this corpus is one continuous cloud: hackathon projects form a continuum, and no UMAP setting
    separated it (min_dist 0-0.1, n_neighbors 15-80 tried on the 8,409 corpus). Groups come from k-means on the
    embeddings, not from 3D position, so a system is projects with similar descriptions.
    """
    from sklearn.cluster import KMeans

    k = max(1, min(GROUPS_MAX, len(vectors) // GROUP_SIZE))
    if k == 1:
        return xyz
    label = KMeans(k, n_init=3, random_state=SEED).fit_predict(vectors)
    centre = np.stack([xyz[label == i].mean(0) for i in range(k)])[label]
    # ponytail: spread and tighten are tuned by eye on the 8,409 corpus; re-render the top view after a big release.
    return SPREAD * centre + TIGHTEN * (xyz - centre)


def project(vectors: np.ndarray) -> np.ndarray:
    """UMAP to 3D with cosine distance and a fixed seed, grouped into systems, scaled into a unit cube centred on 0."""
    import umap

    n = len(vectors)
    xyz = umap.UMAP(n_components=3, metric="cosine", n_neighbors=min(15, n - 1), random_state=SEED).fit_transform(vectors)
    xyz = systems(vectors, xyz)
    xyz = xyz - (xyz.max(0) + xyz.min(0)) / 2
    return xyz / max(float(np.ptp(xyz, axis=0).max()), 1e-9)


def year(r: dict) -> int | None:
    return int(r["date"][:4]) if r.get("date") and r["date"][:4].isdigit() else None


def load(records: list[dict], vectors: np.ndarray, xyz: np.ndarray, version: str) -> int:
    import psycopg

    rows = [(r["id"], r["url"], r["title"], r.get("tagline"), r["description"], json.dumps(r["technologies"]),
             json.dumps(r["events"]), r.get("date"), r["date_kind"], r["source"], r["fetched_at"], r["content_hash"],
             "[" + ",".join(f"{x:.7f}" for x in v) + "]", float(p[0]), float(p[1]), float(p[2]), version)
            for r, v, p in zip(records, vectors, xyz)]
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
        cur.execute("delete from projects")  # one transaction: readers see the old corpus or the new one, never a mix
        cur.executemany(
            "insert into projects (id, url, title, tagline, description, technologies, events, date, date_kind, source,"
            " fetched_at, content_hash, embedding, x, y, z, corpus_version)"
            " values (%s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s, %s, %s, %s, %s::vector, %s, %s, %s, %s)", rows)
        # Rebuild the graph after replacing every row; stale HNSW entries can miss true nearest neighbors.
        cur.execute("REINDEX INDEX projects_embedding_hnsw")
        cur.execute("ANALYZE projects")
        cur.execute("select count(*) from projects where corpus_version = %s", (version,))
        return cur.fetchone()[0]


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", type=Path, default=ROOT / "corpus" / "data" / "projects.jsonl")
    ap.add_argument("--no-load", action="store_true", help="embed and project only; skip Neon and stars.json")
    args = ap.parse_args(argv)
    load_env()
    records = [json.loads(line) for line in args.input.read_text().splitlines() if line.strip()]
    records = list({r["id"]: r for r in records}.values())  # a resumed fetch can repeat a record; last one wins
    version = f"{date.today().isoformat()}-{len(records)}"
    vectors = cached_embeddings(records)
    xyz = project(vectors)
    if args.no_load:
        print(f"embed: {len(records)} records embedded and projected (not loaded)")
        return 0
    loaded = load(records, vectors, xyz, version)
    STARS.parent.mkdir(parents=True, exist_ok=True)
    STARS.write_text(json.dumps({
        "corpus_version": version,
        "count": loaded,
        "stars": [{"id": r["id"], "x": round(float(p[0]), 4), "y": round(float(p[1]), 4), "z": round(float(p[2]), 4),
                   "title": r["title"], "event": r["events"][0]["name"] if r["events"] else None, "year": year(r)}
                  for r, p in zip(records, xyz)],
    }, separators=(",", ":")))
    print(f"embed: loaded {loaded} rows, corpus_version {version}, wrote {STARS.relative_to(ROOT)}")
    return 0 if loaded == len(records) else 1


if __name__ == "__main__":
    sys.exit(main())
