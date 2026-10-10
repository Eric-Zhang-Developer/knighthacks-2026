# Mac takeover — incomplete, do not merge yet

Windows worker kiro-agent-1 stopped at the user's request on 2026-10-10 because Codex usage is nearly exhausted.
PR #285 / issue #273 remains draft. Continue this branch; do not open a competing implementation.

## What is saved

`checkpoints/2026-10-10-8409.json` contains 304 successful Gemini batches covering 7,600 projects, keyed by the
runner's model/prompt/source digest. It contains no database URL, API key or full source descriptions.
Three Replit editor-only claims were conservatively normalized to unknown by the current source-quote validator.
The checkpoint is explicitly incomplete. Do not publish it as `classes.json`.

The full run used `gemini-3.8-flash`, batch size 25, concurrency 4 and 398 provider calls. It read 8,409 projects
for corpus version `2026-10-10-8409` and 263 distinct prize strings. Eventually 809 projects and all 263 prize
strings exhausted their bounded retry. A subsequent diagnostic returned HTTP 429:
**the Gemini project has exceeded its monthly spending cap**. No more retries were made after that diagnosis.
This is not a reason to increase concurrency, silently change credentials/providers or publish fallback prize labels.

## Resume without repeating successful calls

After the operator resolves the Gemini spending cap, use the same model, source version and batch size.
Restore the committed successful batches into the ignored local cache from the repository root:

```sh
python - <<'PY'
import json
from pathlib import Path
p = Path('corpus/classify/checkpoints/2026-10-10-8409.json')
saved = json.loads(p.read_text(encoding='utf-8'))
cache = Path('corpus/classify/.cache')
cache.mkdir(parents=True, exist_ok=True)
for digest, values in saved['batches'].items():
    assert len(digest) == 64 and all(c in '0123456789abcdef' for c in digest)
    (cache / (digest + '.json')).write_text(json.dumps(values), encoding='utf-8')
print(saved['successful_project_count'], 'project results restored')
PY
python corpus/classify/run.py
python corpus/classify/run.py --check
python corpus/classify/review.py
```

Provide credentials through the environment only. The runner reads Neon through an explicitly read-only connection.
The original full source and failed artifact remain private in the Windows worktree's ignored `.cache/`; Mac can
read the same version from Neon. Changed source text/model/prompt correctly invalidates its affected cache entries.
Fallback results were never cached, so resumption retries only unfinished work.

## Acceptance still required

- Run to completion with actual categories and prize classifications; investigate any remaining failures.
- Review 50 random projects, 3 per domain, 20 mixed/insufficient projects and every distinct prize string against
  sources. `review.py` prepares complete source samples and hashes; it does not judge itself. Write real counts
  in `specs/decisions/corpus-classify-review.md`. No final sample review has been completed.
- Watch for product AI integrations versus coding assistance, reward brands versus sponsor names, and ranking
  numbers versus track numbers/shortlists. Verbatim quotes alone do not establish the intended semantics.
- Run the spec's pytest entry point, repository Checks and canonical `verify.py`; write the done note last.
- Check fresh main, STOP, milestone gates, entire PR verdict and CI before merging. No release acceptance is claimed.

Latest local checks before handoff: 24 classifier tests passed with the public-artifact test pending; typecheck,
lint and 358 application tests passed (2 existing opt-in skips) after rebasing onto main `143fd45`.
Earlier code head `564a46c` had green CI/Vercel and both runner checks. The handoff commit needs its own CI verdict.
Independent code review found no blocker; its suggested artifact assertion was applied. No frontend files or
production database contents were changed. No `changes/corpus-classify.md` exists yet.
