# Separate collectors, one merged corpus

The person requested a second machine collecting at up to five requests per second, with no duplicate projects
and a source link for every record. The Mac growth worker on #262 owns publication. Resume fix #360 is already
merged; do not replace its implementation or restart the Mac merely to acquire it.

Use explicitly assigned source manifests and separate data directories. A stable exported list of known project
URLs avoids fetching prior work. Event assignments prevent duplicate gallery work, but a project can belong to
several events: final uniqueness is enforced by canonical project URL and its SHA-1 ID during checkpoint merge.
This does not claim exactly-once HTTP requests across independent machines. Keep the existing rate/backoff/stop
rules on each collector; do not restart through a host refusal. Unknown dates stay unknown.

Merge closed, stable checkpoints into a new output, retaining event memberships and source observations; never
read a checkpoint while another process appends it. Invalid identity or missing provenance fails the merge.
One release owner embeds the combined output and validates the matching stars/classes bundle on test Neon.
The current loader replaces the entire projects table: no collector may publish its own partial dataset.

Rollback: stop the additional collector, keep its checkpoint, and resume the original source assignment. No
database schema or production data changes are part of this collector fix.
