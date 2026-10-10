# corpus-embed: where vectors come from

**Context.** The spec requires the stored corpus vectors to match what the app gets at request time (cosine >= 0.99).
**Options.** A: embed locally with bge-m3 (free, about 3 GB of model and torch; this Mac had about 10 GB free). B: embed
through the Hugging Face Inference API (`hf-inference`), the same endpoint the app calls.
**Choice.** B. Parity check, 2026-10-10, 5 fixture texts, Python `huggingface_hub` vs JS `@huggingface/inference`:
cosine `1.000000 1.000000 1.000000 1.000000 1.000000`. Embedded text is title + tagline + description, cut at
2000 characters, to bound cost; queries are short ideas, so they're never cut. Vectors are cached by content hash
in `corpus/data/embeddings.npz`, so reruns don't pay again.
**How to undo.** Switch `embed()` in `corpus/embed/run.py` to a local model, rerun the parity check, and re-embed.
