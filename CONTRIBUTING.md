# Contributing

1. Branch from `main`: `git checkout -b feat/short-description`.
2. Make the change with tests. Run `pnpm lint && pnpm typecheck && pnpm test`.
3. Open a PR with a Conventional Commits title (`feat: …`, `fix: …`). CI must be green; a preview URL is posted to the PR.
4. Squash-merge. `main` deploys to production automatically.

Schema changes need a generated migration (`pnpm db:generate`) in the same PR. Infra changes under `infra/` get a Terraform plan comment on the PR and apply on merge.
