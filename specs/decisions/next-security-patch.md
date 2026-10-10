# Next.js security patch for Vercel deployment

Context: issue #40 records Vercel rejecting the current Next15.5.4 build on main and galaxy with `Vulnerable version of Next.js detected`. The Windows account cannot access that team's build logs; the evidence comes from the Mac worker's deployment inspection. GitHub CI and local builds alone do not prove a Vercel deployment succeeds.

Proposed change: pin `next` and `eslint-config-next` to15.5.27, retaining the current framework and15.5 release line. The official September30 security release recommends15.5.27 for this line: https://nextjs.org/blog/september-2026-security-release. Refresh only the corresponding lockfile resolution. No check is disabled or made optional.

Governance: the current AGENTS contract rule permits additive changes only. Replacing frozen version pins is an exception; this proposal requires explicit owner approval before merge. The existing feature and infrastructure PRs continue to require a green complete GitHub verdict.

Validation: repository static/unit checks, a real production bootstrap browser run, and the resulting Vercel preview must pass before claiming the deployment blocker is fixed. Local evidence and the deployment result belong in the PR.

Undo: revert the version-pin and lockfile commit; this also restores the old deployment rejection and should not be presented as a safe production fallback.
