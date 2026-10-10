---
name: Lay the corpus out in 2D, so the flat map has no overlapping clusters
depends_on: [corpus-embed]
owns: [corpus/embed/, public/corpus/stars.json, tests/corpus-layout-2d/]
assignee: ""
---

# Corpus layout 2D

Backend/data (user decision 2026-10-10: the galaxy becomes a 2D map, `galaxy-2d`). Today's positions come from a 3D
projection, so the flat map draws a top-down view of a 3D layout and clusters that were apart in depth can land on
top of each other. This feature projects the same embeddings to 2D.

## Plan
1. In `corpus/embed/`, project the existing embeddings to two dimensions with the same method and settings as the
   3D projection (and the star-system arrangement from #301, if it applies to 2D). Write `z = 0` for every star.
2. Normalise `x, y` to the same range as today (about ±0.5), so the map's zoom limits still fit.
3. Keep `corpus_version` unchanged (the same projects); add `layout: "2d"` to `stars.json`. `classes.json` and other
   files keyed by `corpus_version` keep working.

## Requirements
- Same set of ids as the current `stars.json`; no project added or dropped.
- Deterministic: a fixed random seed, so a re-run gives the same positions.

## Validation
1. `stars.json` has the same ids and `corpus_version` as before, every `z` is 0, and `layout` is `"2d"`.
2. Each project's 10 nearest neighbours in 2D share at least 5 with its 10 nearest in embedding space, for at
   least 70% of a 500-project sample (the map still means "near = similar").
3. Two runs give byte-identical `stars.json`.

## Defaults
The projection library `corpus-embed` already uses; no new service.
