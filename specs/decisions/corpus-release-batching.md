# Resume the approved release with larger provider batches

The saved checkpoint already contains 8,409 records; embedding requests are the remaining preparation bottleneck. A bounded test on the same 64 cached texts took 31.771 seconds with batches of 16 and 19.188 seconds with a batch of 64. Minimum cosine similarity to cached embeddings was 1.0 and 0.9999999404 respectively. These are single observations, not a sustained throughput guarantee.

Use batch size 64 in the local release helper, retaining the existing timeout, retry and atomic cache writer. The existing process was stopped before the replacement resumed its cache (4,312 input records cached; 4,097 remaining). No parallel full-corpus runs or new collection are started. Tracked embedding defaults stay unchanged. Undo by stopping the single helper and resuming the same cache with batch size 16.

A second bounded comparison on 128 cached texts took 54.639 seconds for sequential 64-record requests and 34.886 seconds for two concurrent requests, both with minimum cosine 0.9999999404. The local helper now uses at most two 64-record provider requests and one atomic cache writer; all results retain input order. No additional dependencies or tracked pipeline changes. Stop that helper before reverting to sequential requests.
