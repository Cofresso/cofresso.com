# Infrastructure

Terraform for cofresso.com on GCP. State lives in `gs://cofresso-prod-tfstate`.

## First time

```bash
./bootstrap.sh            # creates project, billing link, state bucket (idempotent)
terraform init
terraform plan
terraform apply
```

## Day to day

Changes under `infra/` get a plan comment on the PR and apply automatically on merge to `main` (see `.github/workflows/infra.yml`). Local `terraform plan` is fine; prefer letting CI apply.

## What is here

Cloud Run (`cofresso-web`, `cofresso-web-preview`, migration jobs), Cloud SQL Postgres 16, Artifact Registry, global HTTPS load balancer with Cloud CDN and a managed certificate, Cloud DNS zone, Workload Identity Federation for GitHub Actions, an uptime check and alert policy.

Container images and the deployed revision are managed by CI, not Terraform (`ignore_changes` on the image).

## Outputs you will need

`terraform output` prints the nameservers to paste into the registrar, the load balancer IP, Cloud Run URLs, the WIF provider resource name and service account emails used by GitHub Actions.
