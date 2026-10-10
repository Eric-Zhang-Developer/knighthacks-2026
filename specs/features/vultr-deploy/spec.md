---
name: Add-on: run the same app on a Vultr VM
depends_on: [share-qr-ui]
owns: [deploy/, Dockerfile, .dockerignore]
assignee: ""
---

# Vultr deploy (add-on)

## Plan
1. Dockerfile for the Next.js app (standalone output); `deploy/vultr/README.md` with exact steps.
2. A person provisions the VM and secrets (needs-human); then deploy and run `verify_release.py` against it.

## Requirements
- No code change to the app; if one is needed, it's a separate `fix:` PR.
- Claim the Vultr track only if the deployed URL passes `verify_release.py`.

## Validation
1. `docker build` and `docker run` locally -> `/api/health` returns the commit.
2. On the VM: `python3 .agents/scripts/verify_release.py --commit <sha>` against its URL -> pass.

## Defaults
Vercel stays the primary deploy.
