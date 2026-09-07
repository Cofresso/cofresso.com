# Deploying

## Normal path

Merge a PR into `main`. The `deploy-production` job builds the image, points `cofresso-migrate` at it and runs it once (the job's args are `dist/db.mjs deploy`, which migrates and then runs the idempotent seed in a single execution), deploys `cofresso-web`, moves traffic to the new revision with `update-traffic --to-latest`, then smoke tests `/api/health` for the new commit sha and `/_next/image` for the optimizer.

The explicit `update-traffic` matters after a rollback: a rolled-back service pins traffic to a named revision, so `gcloud run deploy` alone would create a revision that serves nobody.

## Preview

Every PR from this repo deploys a zero-traffic revision to `cofresso-web-preview` tagged `pr-<n>`. The URL is in the sticky PR comment. Previews share the `cofresso_preview` database; migrations from open PRs accumulate there. Reset it with the database runbook if it drifts.

## Manual deploy (break glass)

```bash
REPO=us-central1-docker.pkg.dev/cofresso-prod/web
SHA=$(git rev-parse --short HEAD)
docker buildx build --platform linux/amd64 --build-arg GIT_SHA=$SHA -t $REPO/web:sha-$SHA --push .
gcloud run jobs update cofresso-migrate --image $REPO/web:sha-$SHA --region us-central1 && gcloud run jobs execute cofresso-migrate --region us-central1 --wait
gcloud run deploy cofresso-web --image $REPO/web:sha-$SHA --region us-central1
gcloud run services update-traffic cofresso-web --to-latest --region us-central1
```

Do not add `--args` to `jobs execute`: gcloud 548.x rejects arg overrides client-side
("unknown field priorityTier"). The job already carries `dist/db.mjs deploy`. To run a
different subcommand, change the args with `jobs update` first (see the database runbook).
