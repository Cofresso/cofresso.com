# Security

Cofresso is a demo storefront. Payments are simulated and no real card data is processed. Still, please report anything that looks like a vulnerability to security@coframe.com rather than opening a public issue. We aim to respond within two business days.

Scope: this repository, cofresso.com and its preview deployments.

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

## Not implemented

Deliberate gaps, acceptable for a demo store, worth closing before this took real orders:
no rate limiting on guest order lookup, newsletter signup or promo code attempts, and
order numbers are sequential (`CF-10001`, `CF-10002`, …), so the order volume is guessable
and guest lookup — which takes an order number plus the order's email address — can be
brute forced against a known email address. (The confirmation page is separate: it needs
the 32-character `lookup_token` generated at checkout.)
