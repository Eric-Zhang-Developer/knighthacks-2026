# search-filters-ui: projects in more than one event

Context: a project can be in several events. `/api/search?event=` matches any of them (`events @> [{name}]`), but
each hit's `event` is only the first (`events->0`), so a BloomKnights filter listed "Chronos" labelled "DSH Hacks V1"
(found by the e2e on the test branch). `stars.json` also carries only the first event.

Options: A. label results with the filtered event while an event filter is on; B. change the search API to return the
matched event (a `fix(search)` PR); C. leave the first event showing.

Choice: A. The server's filter already confirmed membership, so the label is true; it is one line in this feature.
Known ceiling: option counts and the empty-query list come from `stars.json`, so they count and list projects by
their first event only; a project whose BloomKnights entry is a second event appears under BloomKnights only once a
query is typed.

How to undo: drop the second argument to `meta` in `components/search/index.tsx`.
