# Standalone app on Vultr

Vercel remains primary. This is the same Next.js app, with the existing frozen `public/corpus/stars.json`.
The image runs as the unprivileged `node` user. It contains the standalone server, static assets and public files;
credentials enter only at runtime. The build context is allowlisted in `.dockerignore`.

## Prerequisites

A person provisions the VM and SSH access under issue #15. Use a Linux VM with Docker Engine and enough memory
for a Next.js build, or build for the VM's architecture elsewhere. Install Git and Python 3 for release verification.
Put the runtime values from `.env.example` in `/etc/uncharted/runtime.env`, readable only by the deploy operator
(`chmod 600`). Docker env files use literal `NAME=value` lines: do not include shell quoting or `export`.
Use the approved database and generation/embedding credentials; never enable `AI_STUB_DIR` or `AI_STUB_ALLOW`.
Any production schema preparation stays under issue #113; this image does not apply schemas or rebuild the corpus.

## Build and local health check

From a clean checkout of the reviewed commit (including this Dockerfile), with Docker running:

```sh
commit=$(git rev-parse HEAD)
docker build --build-arg GIT_COMMIT="$commit" --tag "uncharted:$commit" .
docker run --detach --rm --name uncharted-check --publish 127.0.0.1:3300:3000 "uncharted:$commit"
# After the server starts, this must return exactly the built commit:
curl --fail --silent http://127.0.0.1:3300/api/health | python3 -c 'import json,sys; assert json.load(sys.stdin)["commit"] == sys.argv[1]' "$commit"
python3 .agents/scripts/verify_release.py --commit "$commit" --url http://127.0.0.1:3300 --allow-http
docker stop uncharted-check
```

The health/home checks need no credentials. Exercising AI and saved-state operations additionally needs the
approved test environment supplied with `--env-file /path/to/test.env`. Keep that file outside the checkout.
For a different VM architecture, build with `docker buildx build --platform linux/amd64 --load ...` (or arm64
for an ARM VM), retaining the same commit argument. Do not tag an unreviewed tree as a reviewed commit.

## Deploy after VM access is supplied

On the VM, clone this repository, fetch, and check out the exact reviewed commit. Build as above. Keep the prior
container/image and its runtime env file for rollback. For a first deployment:

```sh
commit=$(git rev-parse HEAD)
docker run --detach --name uncharted --restart unless-stopped \
  --publish 127.0.0.1:3000:3000 --env-file /etc/uncharted/runtime.env "uncharted:$commit"
```

Terminate HTTPS at the VM's reverse proxy and forward to `127.0.0.1:3000`, preserving the original Host header.
Point the approved hostname at the VM and allow public HTTPS, keeping the application port bound to loopback.
HTTPS is required for the workspace's Secure cookies; a bare HTTP VM is not a functioning user-flow deployment.
Use the project's existing domain/TLS setup if one is supplied; otherwise this remains part of provisioning #15.

Before changing the proxy for an upgrade, run the new image as `uncharted-candidate` on loopback port 3300 and
check its health commit. Keep the old `uncharted` container running until candidate verification passes; switch
the proxy to the candidate only after deployment is authorized. Preserve its previous upstream for rollback.

From the reviewed checkout, set `DEPLOY_URL` to the actual bare HTTPS origin and verify:

```sh
python3 .agents/scripts/verify_release.py --commit "$commit" --url "$DEPLOY_URL"
python3 .agents/scripts/demo_snapshot.py --url "$DEPLOY_URL" --out "$HOME/uncharted-fallback-$commit"
```

Retain the verifier's actual JSON output and `reports/deploys.md` receipt outside git, and capture the configured
snapshot using `demo_snapshot.py`. Verify the real app flow against the new origin before claiming the Vultr track.
Never record credentials, cookies, invite links or share tokens in deployment evidence.

## Rollback

Restore the proxy's previous upstream to the still-running previous container and verify its original commit.
This deployment changes no database schema or corpus data, so container rollback does not reverse any separately
approved data change. Do not remove the prior image/container until the new deployment and fallback are verified.

Run the canonical container test with `python3 .agents/scripts/verify.py --slug vultr-deploy --worktree .` once Docker is running. Its evidence contains the actual commit and health result; it does not replace VM verification.

## Current verification

Local container verification passed at `6bc866c` on 2026-10-10: Docker built and ran the image as `node`,
`/api/health` returned the full built commit, and `/` returned 200. The canonical verifier saved the actual
receipt under `.git/agent-evidence/vultr-deploy/20261010T153627Z` in the shared repository.

VM verification remains blocked on issue #15: provisioned VM/SSH access, runtime secrets and an HTTPS endpoint
have not been supplied. No Vultr deployment or sponsor-track claim has been made.
