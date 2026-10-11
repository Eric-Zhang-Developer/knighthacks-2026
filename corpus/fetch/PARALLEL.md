# Two collectors, one release

Agree the event assignment with the running worker on #262 before starting. Event date order is optional;
source URLs are the assignment keys. The API's recently-added ordering is not chronological event order.
Put only this machine's assigned events in a stable JSONL manifest, keeping the usual source fields.

Run from current main, in a dedicated checkout, with an exclusive local output directory:

```powershell
python -u corpus/fetch/run.py fetch --sources windows-sources.jsonl --data-dir windows-data --exclude-projects mac-known.jsonl --rps 5 --workers 5 --deadline 2026-10-11T03:00:00-04:00
```

`mac-known.jsonl` is a stable export with a `url` or SHA-1 `id` per known project. Repeat `--exclude-projects` for other
checkpoints. Do not treat summaries as complete projects in the skip list: their descriptions have not been
fetched. Check each source host's robots.txt before collecting. Retain the first-429 backoff/rate reduction and
stop on a subsequent 429 or any 403; never restart just to bypass a refusal. Keep raw unknown fields empty.

`projects.jsonl`, `summaries.jsonl`, `rejected.jsonl`, and `progress.jsonl` all live under `--data-dir`. Rerun the
same arguments to resume. An external skip list is read at startup, not a distributed lock: cross-event duplicate
HTTP requests remain possible. The final dataset's uniqueness is enforced during merge. Keep the original
snapshots, including summaries that do not yet have a full project.

At handoff, stop both writers gracefully or obtain their closed stable snapshots. Transfer all files with SHA-256
checksums. The publication owner runs:

```powershell
python corpus/fetch/merge.py mac-snapshot/projects.jsonl windows-snapshot/projects.jsonl --summaries mac-snapshot/summaries.jsonl --summaries windows-snapshot/summaries.jsonl --output combined/projects.jsonl
```

The merge validates before atomically replacing its output and refuses to overwrite inputs. It prints raw/unique
counts and duplicates merged. Each result keeps its canonical source link, all event memberships, and source
observations. A winner badge never becomes an invented prize name. The existing embedding loader reads the
ordinary fields; additional observations remain in the retained merged checkpoint (not a new database column).

Only the release owner may load the **combined** file into test Neon and perform the existing release checks.
The current embed loader deletes and replaces the projects table: never load one worker's partial file. Keep the
database, stars coordinates and classification versions/counts consistent under the existing release procedure.
