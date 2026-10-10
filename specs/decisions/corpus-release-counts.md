# Release counters on resumed fetches

Context: the existing fetcher prints counters for its current invocation; a resumed checkpoint does not retain earlier discovery or fetch counts.
Options: infer historical totals from stored rows, or retain the fetcher's exact counters and label their scope.
Choice: the release JSON labels `fetch_scope` as `this invocation`; discovered/fetched/parsed/rejected/deduplicated come from that summary, while indexed/displayed count the entire validated bundle. Prior counters stay unknown rather than being reconstructed as invented data. The fetch stop reason is retained, including HTTP 403/429.
How to undo: add durable cumulative counters to the fetch feature, then update the release summary and its tests to consume those counters.
