"""The systems layout separates groups; no database or provider needed."""

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import run  # noqa: E402


def test_systems_pull_groups_apart():
    rng = np.random.default_rng(0)
    # Four meanings, laid out by "UMAP" as overlapping blobs: the cloud the layout has to break up.
    meaning = np.repeat(np.eye(4), 150, axis=0) + 0.05 * rng.standard_normal((600, 4))
    xyz = np.repeat(rng.standard_normal((4, 3)) * 0.3, 150, axis=0) + rng.standard_normal((600, 3))
    out = run.systems(meaning, xyz)
    label = np.repeat(np.arange(4), 150)

    def separation(p):
        centres = np.stack([p[label == i].mean(0) for i in range(4)])
        within = np.mean([np.linalg.norm(p[label == i] - centres[i], axis=1).mean() for i in range(4)])
        between = np.mean([np.linalg.norm(a - b) for i, a in enumerate(centres) for b in centres[i + 1:]])
        return between / within

    assert separation(out) > 10 * separation(xyz)
    assert np.array_equal(out, run.systems(meaning, xyz))  # fixed seed: same input, same galaxy


def test_tiny_corpus_keeps_umap_layout():
    xyz = np.random.default_rng(1).standard_normal((20, 3))
    assert np.array_equal(run.systems(np.eye(20), xyz), xyz)
