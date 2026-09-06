# Deploying

## Normal path

Merge a PR into `main`. The `deploy-production` job builds the image, runs `cofresso-migrate` (migrate, then seed), deploys `cofresso-web`, and smoke tests `/api/health` for the new commit sha.

## Preview

Every PR from this repo deploys a zero-traffic revision to `cofresso-web-preview` tagged `pr-<n>`. The URL is in the sticky PR comment. Previews share the `cofresso_preview` database; migrations from open PRs accumulate there. Reset it with the database runbook if it drifts.

## Manual deploy (break glass)

```bash
REPO=us-central1-docker.pkg.dev/cofresso-prod/web
SHA=$(git rev-parse --short HEAD)
docker buildx build --platform linux/amd64 --build-arg GIT_SHA=$SHA -t $REPO/web:sha-$SHA --push .
gcloud run jobs update cofresso-migrate --image $REPO/web:sha-$SHA --region us-central1 && gcloud run jobs execute cofresso-migrate --region us-central1 --wait
gcloud run deploy cofresso-web --image $REPO/web:sha-$SHA --region us-central1
```
