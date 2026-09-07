# GitHub configuration

Everything CI needs that is not in a workflow file. Apply with an account that has admin on `cofresso/cofresso.com`.

## Repository variables (non-secret)

| Variable                  | Value                                                    |
| ------------------------- | -------------------------------------------------------- |
| `GCP_PROJECT_ID`          | `cofresso-prod`                                          |
| `GCP_REGION`              | `us-central1`                                            |
| `GCP_WIF_PROVIDER`        | `terraform output -raw wif_provider`                     |
| `GCP_DEPLOYER_SA`         | `terraform output -raw deployer_service_account`         |
| `GCP_PREVIEW_DEPLOYER_SA` | `terraform output -raw preview_deployer_service_account` |
| `GCP_PLANNER_SA`          | `terraform output -raw planner_service_account`          |
| `GCP_APPLIER_SA`          | `terraform output -raw applier_service_account`          |
| `GCP_ARTIFACT_REPO`       | `terraform output -raw artifact_registry`                |
| `PRODUCTION_URL`          | `https://cofresso.com` (Cloud Run URL until DNS is live) |

There are **no repository secrets**. Authentication is Workload Identity Federation.

## Environments

- `production`: protected branches only (main). Add required reviewers here to gate deploys.
- `infrastructure`: protected branches only (main). Used by `terraform apply`.
- `preview`: any branch.

## Branch ruleset `main`

Pull request required, squash merges only, linear history, no deletion or force push, review threads resolved, required checks: `lint`, `typecheck`, `unit`, `integration`, `build`, `e2e`, `Conventional Commits title` (strict, up to date with main). Repository admins can bypass for emergencies.

## Merge settings

Squash only; PR title becomes the commit subject; branches auto-delete on merge; auto-merge enabled.

## CI identity boundaries

CI has no long-lived keys; every job impersonates one of four service accounts through
Workload Identity Federation, and the WIF bindings decide which refs may do so.

| Service account           | Which refs                 | What it can do                                                                                         |
| ------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------ |
| `github-deployer-preview` | any ref in this repository | Push images; `run.admin` on the `cofresso-web-preview` service and `cofresso-migrate-preview` job only |
| `github-deployer`         | `refs/heads/main` only     | Push images; deploy production `cofresso-web` and run `cofresso-migrate`                               |
| `terraform-planner`       | any ref in this repository | Read-only: project `viewer` + `iam.securityReviewer`, read on the Terraform state bucket               |
| `terraform-applier`       | `refs/heads/main` only     | A scoped set of admin roles (no `roles/owner`); applies `infra/`                                       |

The provider's `attribute_condition` rejects any token that does not come from
`cofresso/cofresso.com`, so forks cannot exchange one at all. The per-account ref
restriction covers the rest: a pull request can change what CI runs, and tying
`github-deployer` and `terraform-applier` to `refs/heads/main` means a workflow change
authored on a branch cannot reach production or mutate infrastructure — it can only touch
the preview service and job, and read the plan.

**Known weakness — Terraform state contains the generated database password.** The
`plan` job runs on pull requests and can read the state bucket, so a PR that edits
`.github/workflows/infra.yml` could print the password out of state. Hardening options, in
order of effort: require reviewers on a GitHub environment for the `plan` job; or move the
password to a write-only secret version so it never lands in state at all.

See `SECURITY.md` for the same table plus the vulnerability-reporting policy.

## Security

Dependabot alerts and security updates on. CodeQL runs via `.github/workflows/codeql.yml` (do not also enable "default setup", the two conflict).

## Re-applying

The commands used are in `docs/superpowers/plans/2026-09-06-cofresso-cicd.md`, Task 7.
