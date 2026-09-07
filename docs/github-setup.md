# GitHub configuration

Everything CI needs that is not in a workflow file. Apply with an account that has admin on `cofresso/cofresso.com`.

## Repository variables (non-secret)

| Variable            | Value                                                    |
| ------------------- | -------------------------------------------------------- |
| `GCP_PROJECT_ID`    | `cofresso-prod`                                          |
| `GCP_REGION`        | `us-central1`                                            |
| `GCP_WIF_PROVIDER`  | `terraform output -raw wif_provider`                     |
| `GCP_DEPLOYER_SA`   | `terraform output -raw deployer_service_account`         |
| `GCP_PLANNER_SA`    | `terraform output -raw planner_service_account`          |
| `GCP_APPLIER_SA`    | `terraform output -raw applier_service_account`          |
| `GCP_ARTIFACT_REPO` | `terraform output -raw artifact_registry`                |
| `PRODUCTION_URL`    | `https://cofresso.com` (Cloud Run URL until DNS is live) |

There are **no repository secrets**. Authentication is Workload Identity Federation.

## Environments

- `production`: protected branches only (main). Add required reviewers here to gate deploys.
- `infrastructure`: protected branches only (main). Used by `terraform apply`.
- `preview`: any branch.

## Branch ruleset `main`

Pull request required, squash merges only, linear history, no deletion or force push, review threads resolved, required checks: `lint`, `typecheck`, `unit`, `integration`, `build`, `e2e`, `Conventional Commits title` (strict, up to date with main). Repository admins can bypass for emergencies.

## Merge settings

Squash only; PR title becomes the commit subject; branches auto-delete on merge; auto-merge enabled.

## Security

Dependabot alerts and security updates on. CodeQL runs via `.github/workflows/codeql.yml` (do not also enable "default setup", the two conflict).

## Re-applying

The commands used are in `docs/superpowers/plans/2026-09-06-cofresso-cicd.md`, Task 7.
